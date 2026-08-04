import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import {
  createTestDb,
  seedTestData,
  asRole,
  countRows,
  type SeedIds,
  type Uuid,
} from "./rlsTestHarness.ts";

/**
 * RLS integration tests — the highest-value tests this app can have.
 *
 * These run the REAL migrations against a real PostgreSQL (pglite, PG16 in
 * WASM) and exercise the RLS policies as Supabase would: each query runs
 * under `SET ROLE authenticated` (or anon) with a `request.jwt.claims` GUC
 * carrying the actor's id, exactly like PostgREST does in production.
 *
 * Coverage mirrors the security review's recommendations:
 *   - teacher: own class only, no fee/salary/payroll data
 *   - bursar with the "fees" grant; staff with "expenses"/"admissions"
 *   - parent: only their own linked child's data
 *   - second school's proprietor: no cross-tenant reads at all
 *   - regressions for 0030 (admin-flag trigger), 0064 (suspension RLS),
 *     0065 (self-role-escalation WITH CHECK), 0075 (revoked RPCs)
 */

let db: PGlite;
let ids: SeedIds;

before(async () => {
  db = await createTestDb();
  ids = await seedTestData(db);
});

after(async () => {
  await db.close();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function count(
  role: "authenticated" | "anon",
  sub: Uuid | null,
  sql: string
): Promise<number> {
  return countRows(db, role, sub, sql);
}

/**
 * Postgres raises a hard error (SQLSTATE 42501) when an INSERT/UPDATE is
 * blocked by RLS or by a WITH CHECK policy — unlike SELECT, which just
 * returns fewer rows. Tests that assert "cannot write" must therefore
 * treat a 42501 as the RLS boundary, not as a test failure.
 */
function isRlsBlocked(err: unknown): boolean {
  return err instanceof Error && (err as { code?: string }).code === "42501";
}

async function insertReturningCount(
  role: "authenticated" | "anon",
  sub: Uuid | null,
  sql: string
): Promise<number> {
  return asRole(db, role, sub, async () => {
    try {
      const res = await db.query<{ id: string }>(`${sql} returning id`);
      return res.rows.length;
    } catch (err) {
      if (isRlsBlocked(err)) return 0;
      throw err;
    }
  });
}

async function updateAffectedRows(
  role: "authenticated" | "anon",
  sub: Uuid | null,
  sql: string
): Promise<number> {
  return asRole(db, role, sub, async () => {
    try {
      const results = await db.exec(sql);
      return results.reduce((sum, r) => sum + (r.affectedRows ?? 0), 0);
    } catch (err) {
      if (isRlsBlocked(err)) return 0;
      throw err;
    }
  });
}

async function expectError(
  role: "authenticated" | "anon",
  sub: Uuid | null,
  sql: string,
  pattern: RegExp
): Promise<void> {
  await asRole(db, role, sub, async () => {
    await assert.rejects(db.query(sql), (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      assert.match(message, pattern);
      return true;
    });
  });
}

const schoolAStudents = () => `select id from public.students where school_id = '${ids.schoolA}'`;
const schoolAFeedRecords = () => `select id from public.fee_records where school_id = '${ids.schoolA}'`;
const schoolAFeePayments = () => `select id from public.fee_payments where school_id = '${ids.schoolA}'`;
const schoolAResults = () => `select id from public.results where school_id = '${ids.schoolA}'`;
const schoolAAttendance = () => `select id from public.attendance where school_id = '${ids.schoolA}'`;
const schoolASalaries = () => `select id from public.staff_salaries where school_id = '${ids.schoolA}'`;
const schoolAPaymentIntents = () => `select id from public.payment_intents where school_id = '${ids.schoolA}'`;
const schoolATransferAlerts = () => `select id from public.bank_transfer_alerts where school_id = '${ids.schoolA}'`;
const schoolAExpenses = () => `select id from public.expenses where school_id = '${ids.schoolA}'`;
const schoolAProspects = () => `select id from public.admission_prospects where school_id = '${ids.schoolA}'`;
const schoolAAppUsers = () => `select id from public.app_users where school_id = '${ids.schoolA}'`;

// ---------------------------------------------------------------------------
// Proprietor A — sees everything in own school, nothing outside it
// ---------------------------------------------------------------------------

test("proprietor A reads all of school A", async () => {
  assert.equal(await count("authenticated", ids.proprietorA, schoolAStudents()), 2);
  assert.equal(await count("authenticated", ids.proprietorA, schoolAFeedRecords()), 2);
  assert.equal(await count("authenticated", ids.proprietorA, schoolAFeePayments()), 2);
  assert.equal(await count("authenticated", ids.proprietorA, schoolAResults()), 2);
  assert.equal(await count("authenticated", ids.proprietorA, schoolAAttendance()), 2);
  assert.equal(await count("authenticated", ids.proprietorA, schoolASalaries()), 1);
  assert.equal(await count("authenticated", ids.proprietorA, schoolAPaymentIntents()), 1);
  assert.equal(await count("authenticated", ids.proprietorA, schoolATransferAlerts()), 1);
  assert.equal(await count("authenticated", ids.proprietorA, schoolAExpenses()), 1);
  assert.equal(await count("authenticated", ids.proprietorA, schoolAProspects()), 1);
  assert.equal(await count("authenticated", ids.proprietorA, schoolAAppUsers()), 6);
});

test("proprietor A cannot read school B", async () => {
  assert.equal(
    await count("authenticated", ids.proprietorA, `select id from public.students where school_id = '${ids.schoolB}'`),
    0
  );
  assert.equal(
    await count("authenticated", ids.proprietorA, `select id from public.fee_records where school_id = '${ids.schoolB}'`),
    0
  );
});

// ---------------------------------------------------------------------------
// Teacher — own class only
// ---------------------------------------------------------------------------

test("teacher A1 sees only own class's students", async () => {
  assert.equal(await count("authenticated", ids.teacherA1, schoolAStudents()), 1);
  const rows = await asRole(db, "authenticated", ids.teacherA1, async () => {
    const res = await db.query<{ id: string }>(schoolAStudents());
    return res.rows.map((r) => r.id);
  });
  assert.deepEqual(rows, [ids.studentA1]);
});

test("teacher A1 sees own class's results and attendance only", async () => {
  assert.equal(await count("authenticated", ids.teacherA1, schoolAResults()), 1);
  assert.equal(await count("authenticated", ids.teacherA1, schoolAAttendance()), 1);
});

test("teacher A1 cannot read fees, salaries, intents, or transfer alerts", async () => {
  assert.equal(await count("authenticated", ids.teacherA1, schoolAFeedRecords()), 0);
  assert.equal(await count("authenticated", ids.teacherA1, schoolAFeePayments()), 0);
  assert.equal(await count("authenticated", ids.teacherA1, schoolASalaries()), 0);
  assert.equal(await count("authenticated", ids.teacherA1, schoolAPaymentIntents()), 0);
  assert.equal(await count("authenticated", ids.teacherA1, schoolATransferAlerts()), 0);
});

test("teacher A1 can read same-school operational lists but not write them", async () => {
  // expenses/prospects/fee_types are school-wide SELECT (no per-grant gate)
  assert.equal(await count("authenticated", ids.teacherA1, schoolAExpenses()), 1);
  assert.equal(await count("authenticated", ids.teacherA1, schoolAProspects()), 1);
  // ...but inserts are proprietor- or permission-gated
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.teacherA1,
      `insert into public.expenses (school_id, category_id, session, term, amount, description)
       values ('${ids.schoolA}', '${ids.expenseCatA}', '2025/2026', '2', 1000, 'no')`
    ),
    0
  );
});

test("teacher A1 cannot record a fee payment", async () => {
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.teacherA1,
      `insert into public.fee_payments (school_id, fee_record_id, amount, method)
       values ('${ids.schoolA}', '${ids.feeRecordA1}', 1000, 'cash')`
    ),
    0
  );
});

// ---------------------------------------------------------------------------
// Privilege-escalation guards — negative paths for 0065 (WITH CHECK) and 0030
// (protect_school_admin_flag trigger)
// ---------------------------------------------------------------------------

test("self-update changing role to 'proprietor' raises (0077 trigger)", async () => {
  // A plain teacher or staff account calling the API directly must not be
  // able to self-grant role='proprietor'. The 0077 BEFORE trigger fires
  // first (it can compare OLD vs NEW), but even without it the 0065/0076
  // WITH CHECK would reject the row — two independent layers. The error is
  // a hard exception, not a silent no-op, and the statement aborts leaving
  // the row untouched.
  const escalate = (sub: Uuid, sql: string) =>
    expectError("authenticated", sub, sql, /Only the proprietor can change the proprietor role/);

  await escalate(
    ids.teacherA1,
    `update public.app_users set role = 'proprietor' where id = '${ids.teacherA1}'`
  );
  await escalate(
    ids.staffExpenses,
    `update public.app_users set role = 'proprietor' where id = '${ids.staffExpenses}'`
  );

  // The failed statements must not have changed anything
  const roles = await asRole(db, "authenticated", ids.proprietorA, async () => {
    const res = await db.query<{ id: string; role: string }>(
      `select id, role from public.app_users where id in ('${ids.teacherA1}', '${ids.staffExpenses}')`
    );
    return Object.fromEntries(res.rows.map((r) => [r.id, r.role]));
  });
  assert.equal(roles[ids.teacherA1], "teacher");
  assert.equal(roles[ids.staffExpenses], "staff");
});

test("is_school_admin flips raise 'Only the proprietor can change admin status' (0030)", async () => {
  // Teacher or staff flipping their OWN flag — hard error from the trigger,
  // not an RLS row filter.
  await expectError(
    "authenticated",
    ids.teacherA1,
    `update public.app_users set is_school_admin = true where id = '${ids.teacherA1}'`,
    /Only the proprietor can change admin status/
  );
  await expectError(
    "authenticated",
    ids.staffExpenses,
    `update public.app_users set is_school_admin = true where id = '${ids.staffExpenses}'`,
    /Only the proprietor can change admin status/
  );

  // Even a delegated school admin cannot flip the flag: the trigger checks
  // the LITERAL role ('proprietor'), not current_role(), so an admin whose
  // effective role is 'proprietor' is still blocked from changing status.
  const adminId = await newUuid();
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data)
                 values ('${adminId}', 'admin@alpha.test', '{"name":"School Admin"}'::jsonb)`);
  await db.exec(`delete from public.app_users where id = '${adminId}'`);
  try {
    assert.equal(
      await insertReturningCount(
        "authenticated",
        ids.proprietorA,
        `insert into public.app_users (id, school_id, name, role, is_school_admin)
         values ('${adminId}', '${ids.schoolA}', 'School Admin', 'staff', true)`
      ),
      1
    );
    await expectError(
      "authenticated",
      adminId,
      `update public.app_users set is_school_admin = false where id = '${adminId}'`,
      /Only the proprietor can change admin status/
    );
  } finally {
    await db.exec(`delete from auth.users where id = '${adminId}'`);
  }

  // Positive control: the literal proprietor CAN grant and revoke
  assert.equal(
    await updateAffectedRows(
      "authenticated",
      ids.proprietorA,
      `update public.app_users set is_school_admin = true where id = '${ids.teacherA2}'`
    ),
    1
  );
  assert.equal(
    await updateAffectedRows(
      "authenticated",
      ids.proprietorA,
      `update public.app_users set is_school_admin = false where id = '${ids.teacherA2}'`
    ),
    1
  );
});

test("delegated school admin cannot self-grant role='proprietor' (0076)", async () => {
  // 0065's WITH CHECK keyed its proprietor branch off current_role(), which
  // treats a school admin as a proprietor (0030) — so an admin could UPDATE
  // their own row to role='proprietor' and unlock is_owner() salary access
  // (0043 deliberately excludes admins from that). 0076 pins the branch to
  // the LITERAL role: a delegated admin may still manage staff, but no row
  // they write may become a proprietor.
  const adminId = await newUuid();
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data)
                 values ('${adminId}', 'admin2@alpha.test', '{"name":"School Admin"}'::jsonb)`);
  await db.exec(`delete from public.app_users where id = '${adminId}'`);
  try {
    assert.equal(
      await insertReturningCount(
        "authenticated",
        ids.proprietorA,
        `insert into public.app_users (id, school_id, name, role, is_school_admin)
         values ('${adminId}', '${ids.schoolA}', 'School Admin', 'staff', true)`
      ),
      1
    );

    // Self-grant of the literal proprietor role now raises (0077 trigger;
    // the 0076 WITH CHECK remains as the backstop)
    await expectError(
      "authenticated",
      adminId,
      `update public.app_users set role = 'proprietor' where id = '${adminId}'`,
      /Only the proprietor can change the proprietor role/
    );

    // ...and the failed statement left the row untouched
    const role = await asRole(db, "authenticated", ids.proprietorA, async () => {
      const res = await db.query<{ role: string }>(
        `select role from public.app_users where id = '${adminId}'`
      );
      return res.rows[0].role;
    });
    assert.equal(role, "staff");

    // Promoting someone ELSE to proprietor is equally blocked
    await expectError(
      "authenticated",
      adminId,
      `update public.app_users set role = 'proprietor' where id = '${ids.teacherA2}'`,
      /Only the proprietor can change the proprietor role/
    );

    // Legit manager work still works (the app's requireProprietor() path:
    // editing another staff member's profile keeps their non-owner role)
    assert.equal(
      await updateAffectedRows(
        "authenticated",
        adminId,
        `update public.app_users set job_title = 'Senior Bursar' where id = '${ids.staffAdmissions}'`
      ),
      1
    );
  } finally {
    await db.exec(`delete from auth.users where id = '${adminId}'`);
  }
});

test("delegated school admin cannot demote the proprietor (0077 trigger)", async () => {
  const adminId = await makeSchoolAdmin();
  try {
    // RLS lets the admin SEE the owner's row (current_role()='proprietor'),
    // so the UPDATE reaches the 0077 BEFORE trigger — the only place in
    // Postgres where OLD-vs-NEW can be compared (policy expressions see
    // only NEW for WITH CHECK).
    await expectError(
      "authenticated",
      adminId,
      `update public.app_users set role = 'staff' where id = '${ids.proprietorA}'`,
      /Only the proprietor can change the proprietor role/
    );

    // The owner is untouched
    const role = await asRole(db, "authenticated", ids.proprietorA, async () => {
      const res = await db.query<{ role: string }>(
        `select role from public.app_users where id = '${ids.proprietorA}'`
      );
      return res.rows[0].role;
    });
    assert.equal(role, "proprietor");

    // Positive control: the literal proprietor can still change roles
    // (promote the admin, then demote them back)
    assert.equal(
      await updateAffectedRows(
        "authenticated",
        ids.proprietorA,
        `update public.app_users set role = 'proprietor' where id = '${adminId}'`
      ),
      1
    );
    assert.equal(
      await updateAffectedRows(
        "authenticated",
        ids.proprietorA,
        `update public.app_users set role = 'staff' where id = '${adminId}'`
      ),
      1
    );
  } finally {
    await db.exec(`delete from auth.users where id = '${adminId}'`);
  }
});

test("delegated school admin cannot puppet-insert or delete app_users rows (0077)", async () => {
  const adminId = await makeSchoolAdmin();
  const puppetId = await newUuid();
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data)
                 values ('${puppetId}', '${puppetId}@alpha.test', '{}'::jsonb)`);
  await db.exec(`delete from public.app_users where id = '${puppetId}'`);
  try {
    const puppet = (role: string) =>
      `insert into public.app_users (id, school_id, name, role)
       values ('${puppetId}', '${ids.schoolA}', 'Puppet', '${role}')`;

    // A delegated admin cannot insert a 'proprietor' puppet ...
    assert.equal(await insertReturningCount("authenticated", adminId, puppet("proprietor")), 0);
    // ... nor any app_users row at all (INSERT is literal-proprietor only)
    assert.equal(await insertReturningCount("authenticated", adminId, puppet("staff")), 0);

    // Nor can they delete the owner (DELETE is literal-proprietor only)
    assert.equal(
      await updateAffectedRows(
        "authenticated",
        adminId,
        `delete from public.app_users where id = '${ids.proprietorA}'`
      ),
      0
    );

    // Positive control: the literal proprietor can insert and delete
    assert.equal(await insertReturningCount("authenticated", ids.proprietorA, puppet("staff")), 1);
    assert.equal(
      await updateAffectedRows(
        "authenticated",
        ids.proprietorA,
        `delete from public.app_users where id = '${puppetId}'`
      ),
      1
    );
  } finally {
    await db.exec(`delete from auth.users where id = '${puppetId}'`);
    await db.exec(`delete from auth.users where id = '${adminId}'`);
  }
});

test("bootstrap_school still promotes a brand-new user (0077 exemption)", async () => {
  // The 0077 trigger must not break onboarding: bootstrap_school's
  // security-definer UPDATE (school_id NULL -> new, role -> 'proprietor') is
  // the exact transition the trigger exempts, and the only legit
  // self-promotion path (0076's WITH CHECK blocks any direct-API attempt on
  // an unlinked row, since school_id would never match current_school_id()).
  const newUserId = await newUuid();
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data)
                 values ('${newUserId}', '${newUserId}@alpha.test', '{}'::jsonb)`);
  try {
    const schoolId = await asRole(db, "authenticated", newUserId, async () => {
      const res = await db.query<{ bootstrap_school: string }>(
        `select public.bootstrap_school('Bootstrap Test School') as bootstrap_school`
      );
      return res.rows[0].bootstrap_school;
    });
    assert.ok(schoolId, "bootstrap_school returned a school id");

    const role = await asRole(db, "authenticated", newUserId, async () => {
      const res = await db.query<{ role: string }>(
        `select role from public.app_users where id = '${newUserId}'`
      );
      return res.rows[0].role;
    });
    assert.equal(role, "proprietor");

    // Clean up the school (and the grade_bands/assessment_components 0048
    // seeds for it) so the shared fixture stays stable.
    await db.exec(`delete from public.grade_bands where school_id = '${schoolId}'`);
    await db.exec(`delete from public.assessment_components where school_id = '${schoolId}'`);
    await db.exec(`delete from public.schools where id = '${schoolId}'`);
  } finally {
    await db.exec(`delete from auth.users where id = '${newUserId}'`);
  }
});

test("non-proprietors cannot flip OTHER staff's admin flags (USING filter)", async () => {
  // Flipping someone else's row never reaches the trigger: the USING clause
  // hides that row (id != auth.uid(), role != proprietor), so the update
  // silently affects 0 rows instead of raising.
  assert.equal(
    await updateAffectedRows(
      "authenticated",
      ids.teacherA1,
      `update public.app_users set is_school_admin = true where id = '${ids.bursar}'`
    ),
    0
  );
  const flag = await asRole(db, "authenticated", ids.proprietorA, async () => {
    const res = await db.query<{ is_school_admin: boolean }>(
      `select is_school_admin from public.app_users where id = '${ids.bursar}'`
    );
    return res.rows[0].is_school_admin;
  });
  assert.equal(flag, false);
});

test("no-op is_school_admin updates don't raise (trigger only guards changes)", async () => {
  // The trigger fires only when the flag actually changes (is distinct from),
  // so writing the current value back is a legal self-edit.
  assert.equal(
    await updateAffectedRows(
      "authenticated",
      ids.teacherA1,
      `update public.app_users set is_school_admin = false where id = '${ids.teacherA1}'`
    ),
    1
  );
});

// ---------------------------------------------------------------------------
// current_role() audit (0078): the delegated-admin contract
//
// 0030/0043 deliberately give a school admin current_role()='proprietor' for
// every OPERATIONAL module (fees, expenses, classes, students, attendance,
// payroll, ...). The audit found exactly one over-grant beyond that intent:
// schools.status, writable via the generic schools UPDATE policy. 0078 makes
// status platform-admin-only (trigger). These tests pin the boundary: the
// operational contract holds, status is out of reach for both the proprietor
// and a delegated admin, and the platform admin retains the lever.
// ---------------------------------------------------------------------------

test("delegated school admin has equal day-to-day operational power (0043 contract)", async () => {
  // Representative sample across the operational modules — if a future
  // tightening hits the wrong policy, this fails loudly.
  const adminId = await makeSchoolAdmin();
  const classId = await newUuid();
  const expenseId = await newUuid();
  const attendanceId = await newUuid();
  const feeRecordId = await newUuid();
  try {
    assert.equal(
      await insertReturningCount(
        "authenticated",
        adminId,
        `insert into public.classes (id, school_id, name, session, term)
         values ('${classId}', '${ids.schoolA}', 'JSS4A', '2025/2026', '2')`
      ),
      1
    );
    assert.equal(
      await insertReturningCount(
        "authenticated",
        adminId,
        `insert into public.expenses (id, school_id, category_id, session, term, amount, description)
         values ('${expenseId}', '${ids.schoolA}', '${ids.expenseCatA}', '2025/2026', '2', 3000, 'repairs')`
      ),
      1
    );
    assert.equal(
      await insertReturningCount(
        "authenticated",
        adminId,
        `insert into public.attendance (id, school_id, student_id, class_id, date, status)
         values ('${attendanceId}', '${ids.schoolA}', '${ids.studentA2}', '${ids.classA2}', date '2030-02-01', 'present')`
      ),
      1
    );
    assert.equal(
      await insertReturningCount(
        "authenticated",
        adminId,
        `insert into public.fee_records (id, school_id, student_id, fee_type_id, session, term, amount_expected)
         values ('${feeRecordId}', '${ids.schoolA}', '${ids.studentA1}', '${ids.feeTypeA}', '2026/2027', '2', 2000)`
      ),
      1
    );
    assert.equal(
      await updateAffectedRows(
        "authenticated",
        adminId,
        `update public.students set parent_phone = '0800-ADMIN' where id = '${ids.studentA2}'`
      ),
      1
    );
  } finally {
    await db.exec(`delete from public.fee_records where id = '${feeRecordId}'`);
    await db.exec(`delete from public.attendance where id = '${attendanceId}'`);
    await db.exec(`delete from public.expenses where id = '${expenseId}'`);
    await db.exec(`delete from public.classes where id = '${classId}'`);
    await db.exec(`delete from auth.users where id = '${adminId}'`);
  }
});

test("neither proprietor nor delegated admin can change school status (0078)", async () => {
  const adminId = await makeSchoolAdmin();
  try {
    await expectError(
      "authenticated",
      adminId,
      `update public.schools set status = 'suspended' where id = '${ids.schoolA}'`,
      /Only a platform admin can change school status/
    );
    // The literal proprietor is not exempt either: 0064 gives the lever to
    // the platform, and the app never offered a self-suspend UI.
    await expectError(
      "authenticated",
      ids.proprietorA,
      `update public.schools set status = 'suspended' where id = '${ids.schoolA}'`,
      /Only a platform admin can change school status/
    );

    const status = await asRole(db, "authenticated", ids.proprietorA, async () => {
      const res = await db.query<{ status: string }>(
        `select status from public.schools where id = '${ids.schoolA}'`
      );
      return res.rows[0].status;
    });
    assert.equal(status, "active");
  } finally {
    await db.exec(`delete from auth.users where id = '${adminId}'`);
  }
});

test("platform admin can suspend and reactivate a school (0078 positive control)", async () => {
  const paId = await newUuid();
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data)
                 values ('${paId}', '${paId}@alpha.test', '{}'::jsonb)`);
  // platform_admins has RLS with zero policies — only the project owner can
  // seed it (SQL editor / service role), so do it on the superuser connection.
  await db.exec(`insert into public.platform_admins (id) values ('${paId}')`);
  try {
    assert.equal(
      await updateAffectedRows(
        "authenticated",
        paId,
        `update public.schools set status = 'suspended' where id = '${ids.schoolA}'`
      ),
      1
    );
    assert.equal(
      await updateAffectedRows(
        "authenticated",
        paId,
        `update public.schools set status = 'active' where id = '${ids.schoolA}'`
      ),
      1
    );
  } finally {
    await db.exec(`update public.schools set status = 'active' where id = '${ids.schoolA}'`);
    await db.exec(`delete from public.platform_admins where id = '${paId}'`);
    await db.exec(`delete from auth.users where id = '${paId}'`);
  }
});

// ---------------------------------------------------------------------------
// Bursar with the "fees" grant
// ---------------------------------------------------------------------------

test("bursar (fees grant) can read students and fees", async () => {
  assert.equal(await count("authenticated", ids.bursar, schoolAStudents()), 2); // 0063 widening
  assert.equal(await count("authenticated", ids.bursar, schoolAFeedRecords()), 2);
  assert.equal(await count("authenticated", ids.bursar, schoolAFeePayments()), 2);
  assert.equal(await count("authenticated", ids.bursar, schoolAPaymentIntents()), 1);
  assert.equal(await count("authenticated", ids.bursar, schoolATransferAlerts()), 1);
});

test("bursar (fees grant) can record a fee payment", async () => {
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.bursar,
      `insert into public.fee_payments (school_id, fee_record_id, amount, method)
       values ('${ids.schoolA}', '${ids.feeRecordA1}', 1000, 'cash')`
    ),
    1
  );
});

test("bursar (fees grant) cannot read salaries or see other schools", async () => {
  assert.equal(await count("authenticated", ids.bursar, schoolASalaries()), 0);
  assert.equal(
    await count("authenticated", ids.bursar, `select id from public.students where school_id = '${ids.schoolB}'`),
    0
  );
});

// ---------------------------------------------------------------------------
// Staff with "expenses" / "admissions" grants
// ---------------------------------------------------------------------------

test("expenses staff can record expenses but not fee payments", async () => {
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.staffExpenses,
      `insert into public.expenses (school_id, category_id, session, term, amount, description)
       values ('${ids.schoolA}', '${ids.expenseCatA}', '2025/2026', '2', 5000, 'stationery')`
    ),
    1
  );
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.staffExpenses,
      `insert into public.fee_payments (school_id, fee_record_id, amount, method)
       values ('${ids.schoolA}', '${ids.feeRecordA1}', 500, 'cash')`
    ),
    0
  );
  // No fees grant => no fee reads, and no students (0063 widening only covers "fees")
  assert.equal(await count("authenticated", ids.staffExpenses, schoolAFeedRecords()), 0);
  assert.equal(await count("authenticated", ids.staffExpenses, schoolAStudents()), 0);
});

test("admissions staff can record prospects but not fees", async () => {
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.staffAdmissions,
      `insert into public.admission_prospects (school_id, session, full_name, status)
       values ('${ids.schoolA}', '2025/2026', 'New Prospect', 'inquiry')`
    ),
    1
  );
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.staffAdmissions,
      `insert into public.expenses (school_id, category_id, session, term, amount, description)
       values ('${ids.schoolA}', '${ids.expenseCatA}', '2025/2026', '2', 999, 'no')`
    ),
    0
  );
});

// ---------------------------------------------------------------------------
// Parent — own child only
// ---------------------------------------------------------------------------

test("parent sees only their own linked child", async () => {
  assert.equal(await count("authenticated", ids.parentP1, schoolAStudents()), 1);
  const rows = await asRole(db, "authenticated", ids.parentP1, async () => {
    const res = await db.query<{ id: string }>(schoolAStudents());
    return res.rows.map((r) => r.id);
  });
  assert.deepEqual(rows, [ids.studentA1]);
});

test("parent sees own child's results, attendance, fees, payments", async () => {
  assert.equal(await count("authenticated", ids.parentP1, schoolAResults()), 1);
  assert.equal(await count("authenticated", ids.parentP1, schoolAAttendance()), 1);
  // Only their linked child's fee record
  assert.equal(await count("authenticated", ids.parentP1, schoolAFeedRecords()), 1);
  // ...and only payments on that child's records (the bursar test above may
  // have added another payment to feeRecordA1, so assert the scoped set:
  // everything visible is on the child's record, nothing on other children's)
  const childPayments = await count(
    "authenticated",
    ids.parentP1,
    `select id from public.fee_payments where fee_record_id = '${ids.feeRecordA1}'`
  );
  assert.ok(childPayments >= 1, "parent sees their own child's payments");
  assert.equal(
    await count(
      "authenticated",
      ids.parentP1,
      `select id from public.fee_payments where fee_record_id = '${ids.feeRecordA2}'`
    ),
    0
  );
});

test("parent cannot see other children, other schools, or staff data", async () => {
  assert.equal(await count("authenticated", ids.parentP1, schoolAAppUsers()), 0);
  assert.equal(
    await count("authenticated", ids.parentP1, `select id from public.students where school_id = '${ids.schoolB}'`),
    0
  );
  assert.equal(
    await count("authenticated", ids.parentP1, `select id from public.results where student_id = '${ids.studentA2}'`),
    0
  );
});

// ---------------------------------------------------------------------------
// Second school's proprietor — hard cross-tenant isolation
// ---------------------------------------------------------------------------

test("proprietor B cannot read any of school A's data", async () => {
  assert.equal(await count("authenticated", ids.proprietorB, schoolAStudents()), 0);
  assert.equal(await count("authenticated", ids.proprietorB, schoolAFeedRecords()), 0);
  assert.equal(await count("authenticated", ids.proprietorB, schoolAFeePayments()), 0);
  assert.equal(await count("authenticated", ids.proprietorB, schoolAResults()), 0);
  assert.equal(await count("authenticated", ids.proprietorB, schoolAAttendance()), 0);
  assert.equal(await count("authenticated", ids.proprietorB, schoolASalaries()), 0);
  assert.equal(await count("authenticated", ids.proprietorB, schoolAExpenses()), 0);
  assert.equal(await count("authenticated", ids.proprietorB, schoolAProspects()), 0);
  assert.equal(await count("authenticated", ids.proprietorB, schoolAAppUsers()), 0);
});

test("proprietor B reads own school normally", async () => {
  assert.equal(
    await count("authenticated", ids.proprietorB, `select id from public.students where school_id = '${ids.schoolB}'`),
    1
  );
  assert.equal(
    await count("authenticated", ids.proprietorB, `select id from public.fee_records where school_id = '${ids.schoolB}'`),
    1
  );
});

// ---------------------------------------------------------------------------
// Anonymous — nothing at all
// ---------------------------------------------------------------------------

test("anonymous (no JWT) sees no data", async () => {
  assert.equal(await count("anon", null, schoolAStudents()), 0);
  assert.equal(await count("anon", null, schoolAFeedRecords()), 0);
  assert.equal(await count("anon", null, `select id from public.schools`), 0);
});

// ---------------------------------------------------------------------------
// Suspension is enforced at the database level (0064)
// ---------------------------------------------------------------------------

test("suspended school: even the proprietor reads nothing (0064)", async () => {
  await db.exec(`update public.schools set status = 'suspended' where id = '${ids.schoolA}'`);
  try {
    assert.equal(await count("authenticated", ids.proprietorA, schoolAStudents()), 0);
    assert.equal(await count("authenticated", ids.proprietorA, schoolAFeedRecords()), 0);
    assert.equal(await count("authenticated", ids.parentP1, schoolAResults()), 0);
  } finally {
    await db.exec(`update public.schools set status = 'active' where id = '${ids.schoolA}'`);
  }
  // Back to normal once reactivated
  assert.equal(await count("authenticated", ids.proprietorA, schoolAStudents()), 2);
});

// ---------------------------------------------------------------------------
// Revoked/stale RPCs (0075)
// ---------------------------------------------------------------------------

test("link_my_children() no longer exists (0075)", async () => {
  await expectError(
    "authenticated",
    ids.parentP1,
    "select public.link_my_children()",
    /does not exist|link_my_children/i
  );
});

test("next_admission_number(): authenticated only, anon revoked (0075)", async () => {
  // authenticated proprietor can claim a number for their own school
  const ok = await asRole(db, "authenticated", ids.proprietorA, async () => {
    const res = await db.query<{ next_admission_number: string }>(
      `select public.next_admission_number('${ids.schoolA}') as next_admission_number`
    );
    return res.rows[0]?.next_admission_number;
  });
  assert.match(ok ?? "", /^ALPHA-\d{4}$/);

  // anon was revoked from public in 0075 and has no explicit grant
  await expectError(
    "anon",
    null,
    `select public.next_admission_number('${ids.schoolA}')`,
    /permission denied|does not exist/i
  );
});

// ---------------------------------------------------------------------------
// RLS must not let staff read each other's salaries or app_users outside scope
// ---------------------------------------------------------------------------

test("staff cannot read other staff member's salary rows", async () => {
  assert.equal(
    await count("authenticated", ids.staffExpenses, `select id from public.staff_salaries where school_id = '${ids.schoolA}'`),
    0
  );
});

// ---------------------------------------------------------------------------
// Write-path coverage (INSERT / UPDATE / DELETE per role)
//
// Policy map under test (from 0003/0062/0065):
//   results/attendance   INSERT+UPDATE: proprietor OR teacher of the class;
//                        DELETE: proprietor only
//   fee_records          ALL (incl. DELETE): proprietor OR has_permission('fees')
//   classes/students     INSERT/UPDATE/DELETE: proprietor only
//   schools              UPDATE: proprietor, own school only (no INSERT/DELETE)
//   app_users            INSERT/DELETE: proprietor; UPDATE: proprietor or self
//                        (0065 WITH CHECK blocks self role-escalation)
// ---------------------------------------------------------------------------

async function newUuid(): Promise<string> {
  const res = await db.query<{ id: string }>(`select gen_random_uuid() as id`);
  return res.rows[0].id;
}

/** Creates a scratch delegated school admin through the real path: the auth
 * trigger provisions an app_users row for the auth user, and the proprietor
 * inserts it with is_school_admin = true (the 0030 trigger only guards
 * UPDATEs, so this INSERT is legal). Returns the admin's id; callers must
 * delete the auth user in a finally block to clean up. */
async function makeSchoolAdmin(): Promise<string> {
  const id = await newUuid();
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data)
                 values ('${id}', '${id}@alpha.test', '{}'::jsonb)`);
  await db.exec(`delete from public.app_users where id = '${id}'`);
  try {
    const inserted = await insertReturningCount(
      "authenticated",
      ids.proprietorA,
      `insert into public.app_users (id, school_id, name, role, is_school_admin)
       values ('${id}', '${ids.schoolA}', 'School Admin', 'staff', true)`
    );
    assert.equal(inserted, 1);
  } catch (err) {
    await db.exec(`delete from auth.users where id = '${id}'`);
    throw err;
  }
  return id;
}

test("results: teacher inserts/updates own class only; delete is proprietor-only", async () => {
  const ownId = await newUuid();
  const otherId = await newUuid();

  // INSERT: teacher's own class student (studentA1 is in classA1, teacherA1's class)
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.teacherA1,
      `insert into public.results (id, school_id, student_id, subject, session, term, ca_score, exam_score)
       values ('${ownId}', '${ids.schoolA}', '${ids.studentA1}', 'English', '2025/2026', '2', 20, 60)`
    ),
    1
  );
  // INSERT: other teacher's class student (studentA2 is in classA2) blocked
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.teacherA1,
      `insert into public.results (id, school_id, student_id, subject, session, term, ca_score, exam_score)
       values ('${otherId}', '${ids.schoolA}', '${ids.studentA2}', 'English', '2025/2026', '2', 20, 60)`
    ),
    0
  );

  // UPDATE: own class row allowed; other class row filtered out (USING clause)
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `update public.results set ca_score = 25 where id = '${ownId}'`),
    1
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `update public.results set ca_score = 25 where id = '${otherId}'`),
    0
  );

  // DELETE: proprietor only — teacher gets 0 rows even on own class
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `delete from public.results where id = '${ownId}'`),
    0
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorA, `delete from public.results where id = '${ownId}'`),
    1
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorA, `delete from public.results where id = '${otherId}'`),
    0
  );
});

test("attendance: teacher marks own class only; delete is proprietor-only", async () => {
  const ownId = await newUuid();
  const otherId = await newUuid();

  // INSERT: own class (classA1) allowed; other class (classA2) blocked.
  // Use a date with no seed row (attendance has a student_id+date unique key).
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.teacherA1,
      `insert into public.attendance (id, school_id, student_id, class_id, date, status)
       values ('${ownId}', '${ids.schoolA}', '${ids.studentA1}', '${ids.classA1}', date '2030-01-05', 'present')`
    ),
    1
  );
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.teacherA1,
      `insert into public.attendance (id, school_id, student_id, class_id, date, status)
       values ('${otherId}', '${ids.schoolA}', '${ids.studentA2}', '${ids.classA2}', date '2030-01-05', 'present')`
    ),
    0
  );

  // UPDATE: own class row allowed; other class row filtered out
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `update public.attendance set status = 'absent' where id = '${ownId}'`),
    1
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `update public.attendance set status = 'absent' where id = '${otherId}'`),
    0
  );

  // DELETE: proprietor only
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `delete from public.attendance where id = '${ownId}'`),
    0
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorA, `delete from public.attendance where id = '${ownId}'`),
    1
  );
});

test("fee records: bursar with fees grant has full CRUD; teacher has none", async () => {
  const recId = await newUuid();

  // Teacher: no INSERT, no UPDATE, no DELETE on fee_records
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.teacherA1,
      `insert into public.fee_records (id, school_id, student_id, fee_type_id, session, term, amount_expected)
       values ('${recId}', '${ids.schoolA}', '${ids.studentA1}', '${ids.feeTypeA}', '2026/2027', '1', 1000)`
    ),
    0
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `update public.fee_records set amount_expected = 1 where id = '${ids.feeRecordA1}'`),
    0
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `delete from public.fee_records where id = '${ids.feeRecordA1}'`),
    0
  );

  // Bursar (has_permission('fees')): full CRUD including DELETE (0062 for all)
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.bursar,
      `insert into public.fee_records (id, school_id, student_id, fee_type_id, session, term, amount_expected)
       values ('${recId}', '${ids.schoolA}', '${ids.studentA1}', '${ids.feeTypeA}', '2026/2027', '1', 1000)`
    ),
    1
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.bursar, `update public.fee_records set amount_expected = 1100 where id = '${recId}'`),
    1
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.bursar, `delete from public.fee_records where id = '${recId}'`),
    1
  );
});

test("classes: proprietor-only CRUD; staff/teachers cannot write", async () => {
  const classId = await newUuid();
  const ins = `insert into public.classes (id, school_id, name, session, term)
               values ('${classId}', '${ids.schoolA}', 'JSS3A', '2025/2026', '2')`;

  // No one but the proprietor may create classes
  assert.equal(await insertReturningCount("authenticated", ids.teacherA1, ins), 0);
  assert.equal(await insertReturningCount("authenticated", ids.bursar, ins), 0);
  assert.equal(await insertReturningCount("authenticated", ids.proprietorA, ins), 1);

  // Update/delete also proprietor-only
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `update public.classes set name = 'x' where id = '${classId}'`),
    0
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorA, `update public.classes set name = 'JSS3A X' where id = '${classId}'`),
    1
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `delete from public.classes where id = '${classId}'`),
    0
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorA, `delete from public.classes where id = '${classId}'`),
    1
  );
});

test("students: promotion (repointing class_id) and CRUD are proprietor-only", async () => {
  const studentId = await newUuid();
  const targetClass = await newUuid();

  // Create the target class and a scratch student as the proprietor
  await db.exec(`
    insert into public.classes (id, school_id, name, session, term)
    values ('${targetClass}', '${ids.schoolA}', 'SS1A', '2026/2027', '1');
  `);
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.proprietorA,
      `insert into public.students (id, school_id, class_id, full_name)
       values ('${studentId}', '${ids.schoolA}', '${ids.classA1}', 'Scratch Student')`
    ),
    1
  );

  // Teacher and bursar cannot promote (update class_id)
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `update public.students set class_id = '${targetClass}' where id = '${studentId}'`),
    0
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.bursar, `update public.students set class_id = '${targetClass}' where id = '${studentId}'`),
    0
  );

  // Proprietor promotes the student into the next session's class
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorA, `update public.students set class_id = '${targetClass}' where id = '${studentId}'`),
    1
  );

  // Teachers/bursar cannot delete students; proprietor can
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `delete from public.students where id = '${studentId}'`),
    0
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.bursar, `delete from public.students where id = '${studentId}'`),
    0
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorA, `delete from public.students where id = '${studentId}'`),
    1
  );

  // Clean up the scratch class
  await db.exec(`delete from public.classes where id = '${targetClass}'`);
});

test("schools: settings editable by proprietor of that school only", async () => {
  // Teacher and bursar cannot touch school settings at all
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `update public.schools set address = 'hacked' where id = '${ids.schoolA}'`),
    0
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.bursar, `update public.schools set address = 'hacked' where id = '${ids.schoolA}'`),
    0
  );

  // Proprietor edits own school
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorA, `update public.schools set address = '12 Adeola Street, Lagos' where id = '${ids.schoolA}'`),
    1
  );

  // ...but cannot edit another school (cross-tenant)
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorA, `update public.schools set address = 'hacked' where id = '${ids.schoolB}'`),
    0
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorB, `update public.schools set address = 'hacked' where id = '${ids.schoolA}'`),
    0
  );
});

test("app_users: proprietor manages staff; users edit only themselves", async () => {
  // Scratch auth user (the 0005 trigger provisions an app_users row for it —
  // school_id null, role teacher). Delete that row so the INSERT policy is
  // what gets exercised, not a primary-key conflict.
  const newUserId = await newUuid();
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data)
                 values ('${newUserId}', 'scratch@alpha.test', '{"name":"Scratch Staff"}'::jsonb)`);
  await db.exec(`delete from public.app_users where id = '${newUserId}'`);
  const staffId = newUserId;

  // Insert is proprietor-only (teacher blocked, proprietor succeeds)
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.teacherA1,
      `insert into public.app_users (id, school_id, name, role) values ('${staffId}', '${ids.schoolA}', 'Sneaky', 'teacher')`
    ),
    0
  );
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.proprietorA,
      `insert into public.app_users (id, school_id, name, role) values ('${staffId}', '${ids.schoolA}', 'Scratch Staff', 'staff')`
    ),
    1
  );

  // Self-update allowed (job_title); editing someone else blocked by USING
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `update public.app_users set job_title = 'Head' where id = '${ids.teacherA1}'`),
    1
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `update public.app_users set job_title = 'Head' where id = '${ids.bursar}'`),
    0
  );

  // Proprietor can promote/demote roles on other staff; teacher cannot
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorA, `update public.app_users set role = 'staff' where id = '${staffId}'`),
    1
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `update public.app_users set role = 'staff' where id = '${staffId}'`),
    0
  );

  // Delete is proprietor-only
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `delete from public.app_users where id = '${staffId}'`),
    0
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorA, `delete from public.app_users where id = '${staffId}'`),
    1
  );

  // Cleanup: drop the scratch auth user (cascades app_users row)
  await db.exec(`delete from auth.users where id = '${newUserId}'`);
});

// ---------------------------------------------------------------------------
// Money / ops write-path coverage
//
//   fee_payments         proprietor OR has_permission('fees') — full CRUD;
//                        parent = select-only. DB guards: amount > 0,
//                        method enum. No DB duplicate guard (app-layer only,
//                        see fees/actions.ts amount + balance validation).
//   bank_transfer_alerts proprietor OR has_permission('fees') — full CRUD;
//                        "matching" is an UPDATE (status -> 'matched' plus
//                        matched_student_id / matched_fee_payment_id).
//   payment_intents      NO write policies by design (0013): every write goes
//                        through the service-role admin client, so even the
//                        proprietor is RLS-blocked from INSERT/UPDATE/DELETE.
//   staff_salaries       proprietor (or school admin, 0043 current_role())
//                        full CRUD; unique(staff_id) — one row per staff.
// ---------------------------------------------------------------------------

test("fee_payments: fees-granted staff and proprietor can write; teacher/parent cannot", async () => {
  const teacherPayId = await newUuid();
  const bursarPayId = await newUuid();
  const ins = (id: string, amount: number) =>
    `insert into public.fee_payments (id, school_id, fee_record_id, amount, method)
     values ('${id}', '${ids.schoolA}', '${ids.feeRecordA1}', ${amount}, 'cash')`;

  // Use a real seeded payment id so UPDATE/DELETE blocks aren't vacuous
  const seededPay = await db.query<{ id: string }>(
    `select id from public.fee_payments where fee_record_id = '${ids.feeRecordA1}' limit 1`
  );
  const seededPayId = seededPay.rows[0].id;

  // Teacher: no INSERT, no UPDATE, no DELETE
  assert.equal(await insertReturningCount("authenticated", ids.teacherA1, ins(teacherPayId, 500)), 0);
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `update public.fee_payments set amount = 1 where id = '${seededPayId}'`),
    0
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `delete from public.fee_payments where id = '${seededPayId}'`),
    0
  );

  // Parent: select-only — cannot record or alter payments
  assert.equal(await insertReturningCount("authenticated", ids.parentP1, ins(teacherPayId, 500)), 0);
  assert.equal(
    await updateAffectedRows("authenticated", ids.parentP1, `update public.fee_payments set amount = 1 where id = '${seededPayId}'`),
    0
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.parentP1, `delete from public.fee_payments where id = '${seededPayId}'`),
    0
  );

  // Bursar (fees grant): full CRUD
  assert.equal(await insertReturningCount("authenticated", ids.bursar, ins(bursarPayId, 500)), 1);
  assert.equal(
    await updateAffectedRows("authenticated", ids.bursar, `update public.fee_payments set amount = 750 where id = '${bursarPayId}'`),
    1
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.bursar, `delete from public.fee_payments where id = '${bursarPayId}'`),
    1
  );

  // Proprietor: full CRUD
  assert.equal(await insertReturningCount("authenticated", ids.proprietorA, ins(teacherPayId, 900)), 1);
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorA, `update public.fee_payments set amount = 950 where id = '${teacherPayId}'`),
    1
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorA, `delete from public.fee_payments where id = '${teacherPayId}'`),
    1
  );
});

test("fee_payments: DB guards — amount must be positive, method must be valid", async () => {
  // amount > 0 check constraint
  await expectError(
    "authenticated",
    ids.bursar,
    `insert into public.fee_payments (school_id, fee_record_id, amount, method)
     values ('${ids.schoolA}', '${ids.feeRecordA1}', 0, 'cash')`,
    /check constraint/
  );
  await expectError(
    "authenticated",
    ids.bursar,
    `insert into public.fee_payments (school_id, fee_record_id, amount, method)
     values ('${ids.schoolA}', '${ids.feeRecordA1}', -50, 'cash')`,
    /check constraint/
  );
  // method enum check
  await expectError(
    "authenticated",
    ids.bursar,
    `insert into public.fee_payments (school_id, fee_record_id, amount, method)
     values ('${ids.schoolA}', '${ids.feeRecordA1}', 500, 'crypto')`,
    /check constraint/
  );
});

test("fee_payments: duplicate/overpayment guard is app-layer, not a DB constraint", async () => {
  // The schema has no unique constraint on fee_payments, and no trigger caps
  // payments at the record's balance — that validation lives in the server
  // action (fees/actions.ts rejects amount <= 0 and the payment-link flow
  // checks the fee_summary balance). Pin that boundary: a second identical
  // payment row is accepted by the DB, so a client with fees permission is
  // the only thing standing between double-entry and the ledger.
  const dupId = await newUuid();
  const payId = await newUuid();
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.bursar,
      `insert into public.fee_payments (id, school_id, fee_record_id, amount, method)
       values ('${payId}', '${ids.schoolA}', '${ids.feeRecordA1}', 500, 'cash')`
    ),
    1
  );
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.bursar,
      `insert into public.fee_payments (id, school_id, fee_record_id, amount, method)
       values ('${dupId}', '${ids.schoolA}', '${ids.feeRecordA1}', 500, 'cash')`
    ),
    1
  );
  await db.exec(`delete from public.fee_payments where id in ('${payId}', '${dupId}')`);
});

test("bank_transfer_alerts: matching and CRUD are proprietor or fees-granted", async () => {
  const alertId = await newUuid();
  const ins = `insert into public.bank_transfer_alerts (id, school_id, amount, narration)
               values ('${alertId}', '${ids.schoolA}', 25000, 'Transfer from Kelechi Uche')`;

  // Teacher and parent: nothing at all
  assert.equal(await insertReturningCount("authenticated", ids.teacherA1, ins), 0);
  assert.equal(await insertReturningCount("authenticated", ids.parentP1, ins), 0);

  // Bursar (fees grant): create, match, delete. matched_fee_payment_id is an
  // FK to fee_payments.id, so use a real payment row.
  assert.equal(await insertReturningCount("authenticated", ids.bursar, ins), 1);
  const realPayment = await db.query<{ id: string }>(
    `select id from public.fee_payments where fee_record_id = '${ids.feeRecordA1}' limit 1`
  );
  const realPaymentId = realPayment.rows[0].id;
  assert.equal(
    await updateAffectedRows(
      "authenticated",
      ids.bursar,
      `update public.bank_transfer_alerts
       set status = 'matched', matched_student_id = '${ids.studentA1}', matched_fee_payment_id = '${realPaymentId}'
       where id = '${alertId}'`
    ),
    1
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.bursar, `delete from public.bank_transfer_alerts where id = '${alertId}'`),
    1
  );

  // Proprietor: same
  assert.equal(await insertReturningCount("authenticated", ids.proprietorA, ins), 1);
  assert.equal(
    await updateAffectedRows(
      "authenticated",
      ids.proprietorA,
      `update public.bank_transfer_alerts set status = 'ignored' where id = '${alertId}'`
    ),
    1
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorA, `delete from public.bank_transfer_alerts where id = '${alertId}'`),
    1
  );

  // Status enum guard (against a real alert row so the constraint fires)
  const seededAlert = await db.query<{ id: string }>(
    `select id from public.bank_transfer_alerts where school_id = '${ids.schoolA}' limit 1`
  );
  const seededAlertId = seededAlert.rows[0].id;
  await expectError(
    "authenticated",
    ids.bursar,
    `update public.bank_transfer_alerts set status = 'bogus' where id = '${seededAlertId}'`,
    /check constraint/
  );
});

test("payment_intents: writes are service-role-only — even the proprietor is RLS-blocked", async () => {
  const intentId = await newUuid();
  const ins = `insert into public.payment_intents (id, school_id, fee_record_id, student_id, reference, amount, status)
               values ('${intentId}', '${ids.schoolA}', '${ids.feeRecordA1}', '${ids.studentA1}', 'schfee_rls_test', 25000, 'pending')`;

  // No role has an INSERT/UPDATE/DELETE policy on payment_intents (0013:
  // writes happen via the service-role admin client). Assert the boundary:
  // even the proprietor cannot write through the authenticated client.
  assert.equal(await insertReturningCount("authenticated", ids.proprietorA, ins), 0);
  assert.equal(await insertReturningCount("authenticated", ids.bursar, ins), 0);
  assert.equal(await insertReturningCount("authenticated", ids.teacherA1, ins), 0);
  assert.equal(await insertReturningCount("authenticated", ids.parentP1, ins), 0);

  // Transitions (pending -> success/failed) are likewise blocked for everyone
  // (use the real seeded intent id)
  const seededIntent = await db.query<{ id: string }>(
    `select id from public.payment_intents where school_id = '${ids.schoolA}' limit 1`
  );
  const seededIntentId = seededIntent.rows[0].id;
  const transition = `update public.payment_intents set status = 'success' where id = '${seededIntentId}'`;
  assert.equal(await updateAffectedRows("authenticated", ids.proprietorA, transition), 0);
  assert.equal(await updateAffectedRows("authenticated", ids.bursar, transition), 0);
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorA, `delete from public.payment_intents where id = '${seededIntentId}'`),
    0
  );
});

test("staff_salaries: payroll writes are proprietor (or school-admin) only", async () => {
  const salaryId = await newUuid();
  const ins = `insert into public.staff_salaries (id, school_id, staff_id, monthly_salary)
               values ('${salaryId}', '${ids.schoolA}', '${ids.teacherA2}', 200000)`;

  // Teacher, bursar, and non-fee staff: no INSERT/UPDATE/DELETE
  assert.equal(await insertReturningCount("authenticated", ids.teacherA1, ins), 0);
  assert.equal(await insertReturningCount("authenticated", ids.bursar, ins), 0);
  assert.equal(await insertReturningCount("authenticated", ids.staffExpenses, ins), 0);
  const seededSalary = await db.query<{ id: string }>(
    `select id from public.staff_salaries where school_id = '${ids.schoolA}' limit 1`
  );
  const seededSalaryId = seededSalary.rows[0].id;
  assert.equal(
    await updateAffectedRows("authenticated", ids.bursar, `update public.staff_salaries set monthly_salary = 1 where id = '${seededSalaryId}'`),
    0
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.teacherA1, `delete from public.staff_salaries where id = '${seededSalaryId}'`),
    0
  );

  // Proprietor: full CRUD
  assert.equal(await insertReturningCount("authenticated", ids.proprietorA, ins), 1);
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorA, `update public.staff_salaries set monthly_salary = 210000 where id = '${salaryId}'`),
    1
  );
  assert.equal(
    await updateAffectedRows("authenticated", ids.proprietorA, `delete from public.staff_salaries where id = '${salaryId}'`),
    1
  );

  // unique(staff_id) — one salary row per staff member
  await expectError(
    "authenticated",
    ids.proprietorA,
    `insert into public.staff_salaries (school_id, staff_id, monthly_salary)
     values ('${ids.schoolA}', '${ids.teacherA1}', 999)`,
    /duplicate key|unique/
  );
});

test("staff_salaries: delegated school admin has equal payroll power (0043)", async () => {
  // Create a scratch user and have the proprietor make them a school admin
  // (the 0030 trigger only allows the literal proprietor to flip the flag).
  const adminId = await newUuid();
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data)
                 values ('${adminId}', 'admin@alpha.test', '{"name":"School Admin"}'::jsonb)`);
  await db.exec(`delete from public.app_users where id = '${adminId}'`);
  assert.equal(
    await insertReturningCount(
      "authenticated",
      ids.proprietorA,
      `insert into public.app_users (id, school_id, name, role, is_school_admin)
       values ('${adminId}', '${ids.schoolA}', 'School Admin', 'staff', true)`
    ),
    1
  );

  try {
    // current_role() treats a school admin as 'proprietor' (0030/0043), so
    // salaries are visible and writable for them too
    assert.equal(
      await count("authenticated", adminId, `select id from public.staff_salaries where school_id = '${ids.schoolA}'`),
      1
    );
    const sId = await newUuid();
    assert.equal(
      await insertReturningCount(
        "authenticated",
        adminId,
        `insert into public.staff_salaries (id, school_id, staff_id, monthly_salary)
         values ('${sId}', '${ids.schoolA}', '${ids.staffAdmissions}', 120000)`
      ),
      1
    );
    assert.equal(
      await updateAffectedRows("authenticated", adminId, `update public.staff_salaries set monthly_salary = 125000 where id = '${sId}'`),
      1
    );
    assert.equal(
      await updateAffectedRows("authenticated", adminId, `delete from public.staff_salaries where id = '${sId}'`),
      1
    );
  } finally {
    await db.exec(`delete from auth.users where id = '${adminId}'`);
  }
});
