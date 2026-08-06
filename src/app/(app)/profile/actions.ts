"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireProprietor } from "@/lib/current-user";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Term } from "@/lib/types";
import { QUICK_LINK_CATALOG, MAX_QUICK_LINKS } from "@/lib/quickLinks";
import { DASHBOARD_WIDGET_CATALOG } from "@/lib/dashboardWidgets";
import { createWalletTopupIntent, TOPUP_PACKS_NAIRA } from "@/lib/messageWallet";
import { siteOrigin } from "@/lib/siteUrl";
import { resolveBankAccount, createSubaccount } from "@/lib/paystack";

export interface ProfileFormState {
  error?: string;
  success?: string;
}

export async function updateOwnProfile(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const { authId } = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const qualifications = String(formData.get("qualifications") ?? "").trim();

  if (!name) {
    return { error: "Name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_users")
    .update({
      name,
      phone: phone || null,
      address: address || null,
      qualifications: qualifications || null,
    })
    .eq("id", authId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { success: "Profile updated." };
}

export async function saveProfilePhoto(url: string): Promise<void> {
  const { authId, profile } = await requireUser();

  if (profile.role === "proprietor") {
    throw new Error("Profile photos aren't available for the proprietor account.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("app_users").update({ photo_url: url }).eq("id", authId);
  if (error) throw new Error(error.message);

  revalidatePath("/profile");
}

export async function updateSchoolProfile(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const { profile } = await requireProprietor();

  const name = String(formData.get("school_name") ?? "").trim();
  const address = String(formData.get("school_address") ?? "").trim();
  const phone = String(formData.get("school_phone") ?? "").trim();

  if (!name) {
    return { error: "School name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update({ name, address: address || null, phone: phone || null })
    .eq("id", profile.school_id ?? "");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { success: "School profile updated." };
}

export async function saveSchoolLogo(url: string): Promise<void> {
  const { profile } = await requireProprietor();

  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update({ logo_url: url })
    .eq("id", profile.school_id ?? "");

  if (error) throw new Error(error.message);
  revalidatePath("/profile");
}

export async function updateAcademicSession(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const { profile } = await requireProprietor();

  const session = String(formData.get("current_session") ?? "").trim();
  const term = String(formData.get("current_term") ?? "") as Term;

  if (!session) {
    return { error: "Enter the current session, e.g. 2025/2026." };
  }
  if (!["1", "2", "3"].includes(term)) {
    return { error: "Choose a term." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update({ current_session: session, current_term: term })
    .eq("id", profile.school_id ?? "");

  if (error) {
    return { error: error.message };
  }

  // Classes record the session and term they're running, and the class
  // list, timetable and staff performance pages all filter on it. Moving
  // the school to a new term without moving its classes would empty those
  // pages — the classes themselves carry on across terms, only the label
  // changes.
  const { error: classError } = await supabase
    .from("classes")
    .update({ session, term })
    .eq("school_id", profile.school_id ?? "");

  if (classError) {
    return { error: classError.message };
  }

  revalidatePath("/profile");
  revalidatePath("/classes");
  revalidatePath("/timetable");
  return { success: "Academic session updated." };
}

export async function updateFeePolicy(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const { profile } = await requireProprietor();

  const withhold = formData.get("withhold_results_when_owing") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update({ withhold_results_when_owing: withhold })
    .eq("id", profile.school_id ?? "");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return {
    success: withhold
      ? "Results will be held from parents who owe."
      : "Results are visible to all parents.",
  };
}

export async function updateAdmissionPrefix(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const { profile } = await requireProprietor();

  const prefix = String(formData.get("admission_prefix") ?? "")
    .trim()
    .toUpperCase();

  if (!/^[A-Z0-9]{2,8}$/.test(prefix)) {
    return { error: "Enter 2–8 letters or numbers, e.g. OSS." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update({ admission_prefix: prefix })
    .eq("id", profile.school_id ?? "");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return {
    success: `New admission numbers will now read ${prefix}-0001 and up. Numbers already given out don't change.`,
  };
}

export async function updateQuickLinks(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const { profile } = await requireProprietor();

  const validKeys = new Set(QUICK_LINK_CATALOG.map((o) => o.key));
  const selected = formData.getAll("quick_links").map(String).filter((k) => validKeys.has(k));

  if (selected.length === 0) {
    return { error: "Choose at least one quick link." };
  }
  if (selected.length > MAX_QUICK_LINKS) {
    return { error: `Choose at most ${MAX_QUICK_LINKS} quick links.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update({ quick_links: selected })
    .eq("id", profile.school_id ?? "");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: "Quick links updated." };
}

export async function updateDashboardWidgets(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const { profile } = await requireProprietor();

  const validKeys = new Set(DASHBOARD_WIDGET_CATALOG.map((o) => o.key));
  const selected = formData.getAll("widgets").map(String).filter((k) => validKeys.has(k));

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_users")
    .update({ dashboard_widgets: selected })
    .eq("id", profile.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: "Dashboard layout updated." };
}

export interface WalletTopupState {
  url?: string;
  mocked?: boolean;
  error?: string;
}

/**
 * Kicks off a Paystack checkout to top up this school's message wallet —
 * the proprietor-facing equivalent of generatePaymentLink (fees/actions.ts),
 * just crediting message_wallet_transactions instead of a fee_record. The
 * caller navigates the browser to the returned URL; the wallet itself isn't
 * credited until the webhook (or /profile/wallet-callback as a fast-path)
 * confirms the charge.
 */
export async function initiateWalletTopup(amountNaira: number): Promise<WalletTopupState> {
  const { authId, profile, school } = await requireProprietor();

  if (!TOPUP_PACKS_NAIRA.includes(amountNaira)) {
    return { error: "Choose one of the listed top-up amounts." };
  }
  if (!profile.email) {
    return { error: "Your account needs an email on file before you can pay online." };
  }

  const origin = await siteOrigin();
  const admin = createAdminClient();

  const result = await createWalletTopupIntent(admin, {
    schoolId: school?.id ?? profile.school_id ?? "",
    amountNaira,
    email: profile.email,
    callbackUrl: `${origin}/profile/wallet-callback`,
    initiatedBy: authId,
  });

  if (!result.ok || !result.authorizationUrl) {
    return { error: result.error ?? "Could not start the top-up — try again." };
  }

  return { url: result.authorizationUrl, mocked: result.mocked };
}

export interface ResolveAccountState {
  accountName?: string;
  error?: string;
}

/**
 * Verifies a settlement account number before it's saved — the "confirm
 * the name" step every Nigerian fintech app makes you do, so a mistyped
 * digit doesn't quietly point a school's future fee income at a stranger's
 * account. Doesn't save anything; activateOnlinePayments (below) does that
 * once the proprietor has seen and confirmed the resolved name.
 */
export async function resolveSettlementAccount(
  bankCode: string,
  accountNumber: string
): Promise<ResolveAccountState> {
  await requireProprietor();

  if (!bankCode) return { error: "Choose a bank." };
  if (!/^\d{10}$/.test(accountNumber)) return { error: "Enter a 10-digit account number." };

  const result = await resolveBankAccount(accountNumber, bankCode);
  if (!result.ok || !result.accountName) {
    return { error: result.error ?? "Could not verify that account number." };
  }

  return { accountName: result.accountName };
}

export interface ActivateOnlinePaymentsState {
  error?: string;
  success?: string;
}

/**
 * Registers the school as a Paystack subaccount (src/lib/paystack.ts
 * createSubaccount) and stores the result on schools — from this point on,
 * createPaymentIntent (src/lib/payments.ts) grosses up every fee payment
 * and splits it so the school's share settles directly to this account
 * instead of pooling in the platform's own Paystack account.
 */
export async function activateOnlinePayments(
  bankCode: string,
  bankName: string,
  accountNumber: string,
  accountName: string
): Promise<ActivateOnlinePaymentsState> {
  const { profile, school } = await requireProprietor();

  if (!bankCode || !bankName) return { error: "Choose a bank." };
  if (!/^\d{10}$/.test(accountNumber)) return { error: "Enter a 10-digit account number." };
  if (!accountName.trim()) return { error: "Verify the account number first." };

  const result = await createSubaccount({
    businessName: school?.name ?? "School",
    bankCode,
    accountNumber,
  });

  if (!result.ok || !result.subaccountCode) {
    return { error: result.error ?? "Could not set up online payments — try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update({
      paystack_subaccount_code: result.subaccountCode,
      settlement_bank_code: bankCode,
      settlement_bank_name: bankName,
      settlement_account_number: accountNumber,
      settlement_account_name: accountName,
    })
    .eq("id", profile.school_id ?? "");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return {
    success: result.mocked
      ? "Online payments activated (mock mode — set PAYSTACK_SECRET_KEY to go live)."
      : "Online payments activated — parents' payments will now settle directly to this account.",
  };
}

export async function changeOwnPassword(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  await requireUser();

  // The current password is required — Supabase Auth enforces it via the
  // "Secure password change" setting, so a borrowed session on a shared
  // machine can't be taken over by someone who doesn't know the password.
  const currentPassword = String(formData.get("current_password") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (!currentPassword) {
    return { error: "Enter your current password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password,
    current_password: currentPassword,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: "Password changed." };
}
