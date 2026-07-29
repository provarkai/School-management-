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

export async function setPayrollEntryDeduction(
  entryId: string,
  runId: string,
  _prevState: DeductionFormState,
  formData: FormData
): Promise<DeductionFormState> {
  await requireLiteralProprietor();
  const supabase = await createClient();

  const { data: run } = await supabase.from("payroll_runs").select("status").eq("id", runId).single();
  if (run?.status !== "draft") {
    return { error: "This payroll run has already been paid — deductions are locked." };
  }

  const deductions = Number(formData.get("deductions"));
  const reason = String(formData.get("deduction_reason") ?? "").trim() || null;

  if (!Number.isFinite(deductions) || deductions < 0) {
    return { error: "Enter a valid deduction amount." };
  }

  const { error } = await supabase
    .from("payroll_entries")
    .update({ deductions, deduction_reason: reason })
    .eq("id", entryId);

  if (error) return { error: error.message };

  revalidatePath(`/payroll/${runId}`);
  return { success: "Deduction saved." };
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
