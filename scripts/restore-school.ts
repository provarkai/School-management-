/**
 * Restores one school from a nightly snapshot.
 *
 * Run deliberately from a terminal, never from the app — this writes over
 * live data, and there should be no path to it behind a login.
 *
 *   npx tsx scripts/restore-school.ts --list
 *   npx tsx scripts/restore-school.ts --school <id> --list
 *   npx tsx scripts/restore-school.ts --school <id> --date 2026-08-02 --dry-run
 *   npx tsx scripts/restore-school.ts --school <id> --date 2026-08-02 --confirm
 *
 * Needs the same environment as the app: NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, and the four BACKUP_S3_* variables.
 *
 * What it does NOT do: delete rows that exist now but weren't in the
 * snapshot. Rows are upserted by primary key, so a restore repairs
 * damaged or missing data without destroying anything created since the
 * snapshot was taken. That is the safe default after an accident; if you
 * genuinely need the school returned to its exact state on that date,
 * delete it first and then restore.
 */

import { gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { RESTORE_ORDER, type SchoolSnapshot } from "../src/lib/backup";
import { s3ConfigFromEnv, s3GetObject, s3ListObjects } from "../src/lib/s3";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const config = s3ConfigFromEnv();
  if (!config) {
    throw new Error(
      "Backup storage is not configured — set BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET, " +
        "BACKUP_S3_ACCESS_KEY_ID and BACKUP_S3_SECRET_ACCESS_KEY."
    );
  }

  const schoolId = arg("school");

  if (has("list")) {
    const prefix = schoolId ? `schools/${schoolId}/` : "schools/";
    const objects = await s3ListObjects(config, prefix);
    if (objects.length === 0) {
      console.log(`No snapshots found under ${prefix}`);
      return;
    }
    for (const o of objects) {
      console.log(`${o.key}  ${(o.size / 1024).toFixed(0)} KB  ${o.lastModified}`);
    }
    return;
  }

  const date = arg("date");
  if (!schoolId || !date) {
    console.error(
      "Usage: restore-school.ts --school <id> --date <YYYY-MM-DD> [--dry-run | --confirm]"
    );
    process.exit(1);
  }

  const key = `schools/${schoolId}/${date}.json.gz`;
  console.log(`Reading ${key} …`);

  const snapshot = JSON.parse(
    gunzipSync(await s3GetObject(config, key)).toString("utf8")
  ) as SchoolSnapshot;

  if (snapshot.format !== 1) {
    throw new Error(`Snapshot format ${snapshot.format} is newer than this script understands.`);
  }

  console.log(`\nSnapshot of "${snapshot.schoolName}" taken ${snapshot.takenAt}`);
  const totalRows = Object.values(snapshot.counts).reduce((sum, n) => sum + n, 0);
  for (const [table, count] of Object.entries(snapshot.counts)) {
    if (count > 0) console.log(`  ${String(count).padStart(7)}  ${table}`);
  }
  console.log(`  ${String(totalRows).padStart(7)}  TOTAL\n`);

  if (!has("confirm")) {
    console.log(
      has("dry-run")
        ? "Dry run — nothing written."
        : "Nothing written. Re-run with --confirm to restore, or --dry-run to silence this."
    );
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Parents before children, so every foreign key has something to point
  // at by the time it is inserted.
  let restored = 0;
  for (const table of RESTORE_ORDER) {
    const rows = snapshot.tables[table];
    if (!rows || rows.length === 0) continue;

    // Chunked: a single insert of tens of thousands of rows is a request
    // body no server wants.
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await admin.from(table).upsert(chunk);
      if (error) {
        throw new Error(`${table} (rows ${i}–${i + chunk.length}): ${error.message}`);
      }
    }

    restored += rows.length;
    console.log(`  restored ${String(rows.length).padStart(7)}  ${table}`);
  }

  console.log(`\nDone — ${restored} rows restored into "${snapshot.schoolName}".`);
  console.log(
    "Staff and parent logins are NOT restored by this: app_users rows come back, but the " +
      "matching Supabase Auth accounts are separate. Anyone whose auth account was lost " +
      "needs to be re-invited."
  );
}

main().catch((e) => {
  console.error(`\nRestore failed: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
