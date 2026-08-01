"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface CategoryFormState {
  error?: string;
}

export async function createExpenseCategory(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  const { profile } = await requireProprietor();
  const name = String(formData.get("name") ?? "").trim();
  const budgetRaw = String(formData.get("termly_budget") ?? "").trim();
  const termlyBudget = budgetRaw ? Number(budgetRaw) : null;

  if (!name) {
    return { error: "Category name is required." };
  }
  if (termlyBudget !== null && (!Number.isFinite(termlyBudget) || termlyBudget < 0)) {
    return { error: "Budget must be a positive number." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("expense_categories").insert({
    school_id: profile.school_id,
    name,
    termly_budget: termlyBudget,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `"${name}" is already in the category list.` };
    }
    return { error: error.message };
  }

  revalidatePath("/expenses");
  return {};
}

export async function updateExpenseCategoryBudget(categoryId: string, formData: FormData) {
  await requireProprietor();
  const budgetRaw = String(formData.get("termly_budget") ?? "").trim();
  const termlyBudget = budgetRaw ? Number(budgetRaw) : null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_categories")
    .update({ termly_budget: termlyBudget })
    .eq("id", categoryId);

  if (error) throw new Error(error.message);
  revalidatePath("/expenses");
}

export async function deleteExpenseCategory(categoryId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("expense_categories").delete().eq("id", categoryId);
  if (error) throw new Error(error.message);
  revalidatePath("/expenses");
}

export interface ExpenseFormState {
  error?: string;
  success?: string;
}

export async function createExpense(
  _prevState: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  const { profile, school } = await requireProprietor();

  const categoryId = String(formData.get("category_id") ?? "");
  const campusId = String(formData.get("campus_id") ?? "").trim() || null;
  const amount = Number(formData.get("amount"));
  const expenseDate = String(formData.get("expense_date") ?? "").trim();
  const vendor = String(formData.get("vendor") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!categoryId) {
    return { error: "Choose a category." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid amount." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    school_id: profile.school_id,
    category_id: categoryId,
    campus_id: campusId,
    session: school?.current_session ?? "",
    term: school?.current_term ?? "1",
    amount,
    expense_date: expenseDate || undefined,
    vendor: vendor || null,
    description: description || null,
    recorded_by: profile.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/expenses");
  return { success: "Expense recorded." };
}

export async function deleteExpense(expenseId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  if (error) throw new Error(error.message);
  revalidatePath("/expenses");
}
