"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireLiteralProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface SalaryFormState {
  error?: string;
  success?: string;
}

export async function setStaffSalary(
  staffId: string,
  _prevState: SalaryFormState,
  formData: FormData
): Promise<SalaryFormState> {
  const { profile } = await requireLiteralProprietor();
  const supabase = await createClient();

  const amount = Number(formData.get("monthly_salary"));
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Enter a valid salary amount." };
  }

  const { error } = await supabase
    .from("staff_salaries")
    .upsert(
      { school_id: profile.school_id, staff_id: staffId, monthly_salary: amount, updated_at: new Date().toISOString() },
      { onConflict: "staff_id" }
    );

  if (error) return { error: error.message };

  revalidatePath("/payroll");
  return { success: "Salary saved." };
}

export interface PayrollRunFormState {
  error?: string;
}

export async function generatePayrollRun(
  _prevState: PayrollRunFormState,
  formData: FormData
): Promise<PayrollRunFormState> {
  const { profile } = await requireLiteralProprietor();
  const supabase = await createClient();

  const period = String(formData.get("period") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return { error: "Choose a month." };
  }

  const { data: existingRun } = await supabase
    .from("payroll_runs")
    .select("id, status")
    .eq("school_id", profile.school_id ?? "")
    .eq("period", period)
    .maybeSingle();

  let runId: string;
  if (existingRun) {
    runId = existingRun.id;
  } else {
    const { data: created, error: createError } = await supabase
      .from("payroll_runs")
      .insert({ school_id: profile.school_id, period, created_by: profile.id })
      .select("id")
      .single();
    if (createError) return { error: createError.message };
    runId = created.id;
  }

  if (!existingRun || existingRun.status === "draft") {
    const { data: salaries } = await supabase
      .from("staff_salaries")
      .select("staff_id, monthly_salary")
      .eq("school_id", profile.school_id ?? "");

    if (salaries && salaries.length > 0) {
      await supabase.from("payroll_entries").upsert(
        salaries.map((s) => ({
          school_id: profile.school_id,
          payroll_run_id: runId,
          staff_id: s.staff_id,
          base_salary: s.monthly_salary,
        })),
        { onConflict: "payroll_run_id,staff_id" }
      );
    }
  }

  revalidatePath("/payroll");
  redirect(`/payroll/${runId}`);
}

export interface DeductionFormState {
  error?: string;
  success?: string;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// payroll_entries.deductions / deduction_reason are what net_pay (a
// generated column) is computed from, so they're kept as a cached
// sum/summary of the entry's line items in payroll_entry_deductions
// rather than typed directly.
async function recomputeEntryDeductions(supabase: SupabaseClient, entryId: string) {
  const { data: lineItems } = await supabase
    .from("payroll_entry_deductions")
    .select("amount, deduction_types(name)")
    .eq("payroll_entry_id", entryId);

  const total = (lineItems ?? []).reduce((sum, d) => sum + Number(d.amount), 0);
  const reason =
    (lineItems ?? [])
      .map((d) => (d.deduction_types as unknown as { name: string } | null)?.name)
      .filter(Boolean)
      .join(", ") || null;

  await supabase.from("payroll_entries").update({ deductions: total, deduction_reason: reason }).eq("id", entryId);
}

export async function addPayrollDeduction(
  entryId: string,
  runId: string,
  _prevState: DeductionFormState,
  formData: FormData
): Promise<DeductionFormState> {
  const { profile } = await requireLiteralProprietor();
  const supabase = await createClient();

  const { data: run } = await supabase.from("payroll_runs").select("status").eq("id", runId).single();
  if (run?.status !== "draft") {
    return { error: "This payroll run has already been paid — deductions are locked." };
  }

  const deductionTypeId = String(formData.get("deduction_type_id") ?? "");
  const amount = Number(formData.get("amount"));

  if (!deductionTypeId) {
    return { error: "Choose a deduction type." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid amount." };
  }

  const { error } = await supabase.from("payroll_entry_deductions").insert({
    school_id: profile.school_id,
    payroll_entry_id: entryId,
    deduction_type_id: deductionTypeId,
    amount,
  });

  if (error) return { error: error.message };

  await recomputeEntryDeductions(supabase, entryId);

  revalidatePath(`/payroll/${runId}`);
  return { success: "Deduction added." };
}

export async function removePayrollDeduction(deductionId: string, entryId: string, runId: string) {
  await requireLiteralProprietor();
  const supabase = await createClient();

  const { data: run } = await supabase.from("payroll_runs").select("status").eq("id", runId).single();
  if (run?.status !== "draft") {
    throw new Error("This payroll run has already been paid — deductions are locked.");
  }

  const { error } = await supabase.from("payroll_entry_deductions").delete().eq("id", deductionId);
  if (error) throw new Error(error.message);

  await recomputeEntryDeductions(supabase, entryId);
  revalidatePath(`/payroll/${runId}`);
}

export interface DeductionTypeFormState {
  error?: string;
}

export async function createDeductionType(
  _prevState: DeductionTypeFormState,
  formData: FormData
): Promise<DeductionTypeFormState> {
  const { profile } = await requireLiteralProprietor();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "Deduction type name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("deduction_types").insert({ school_id: profile.school_id, name });

  if (error) {
    if (error.code === "23505") {
      return { error: `"${name}" is already in the deduction type list.` };
    }
    return { error: error.message };
  }

  revalidatePath("/payroll");
  return {};
}

export async function deleteDeductionType(typeId: string) {
  await requireLiteralProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("deduction_types").delete().eq("id", typeId);
  if (error) throw new Error(error.message);
  revalidatePath("/payroll");
}

export async function markPayrollRunPaid(runId: string) {
  await requireLiteralProprietor();
  const supabase = await createClient();
  const { error } = await supabase
    .from("payroll_runs")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("status", "draft");

  if (error) throw new Error(error.message);
  revalidatePath(`/payroll/${runId}`);
  revalidatePath("/payroll");
}
