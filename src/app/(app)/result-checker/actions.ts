"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { generatePins } from "@/lib/pins";
import type { Term } from "@/lib/types";

export interface BatchFormState {
  error?: string;
  success?: string;
}

const MAX_BATCH = 1000;

export async function createPinBatch(
  _prevState: BatchFormState,
  formData: FormData
): Promise<BatchFormState> {
  const { profile } = await requireProprietor();

  const session = String(formData.get("session") ?? "").trim();
  const term = String(formData.get("term") ?? "") as Term;
  const quantity = Number(formData.get("quantity"));
  const priceRaw = String(formData.get("price") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!session) {
    return { error: "Enter the session, e.g. 2025/2026." };
  }
  if (!["1", "2", "3"].includes(term)) {
    return { error: "Choose a term." };
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_BATCH) {
    return { error: `Enter a quantity between 1 and ${MAX_BATCH}.` };
  }
  const price = priceRaw ? Number(priceRaw) : null;
  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    return { error: "Enter a valid price, or leave it blank." };
  }

  const supabase = await createClient();

  const { data: batch, error: batchError } = await supabase
    .from("result_checker_batches")
    .insert({
      school_id: profile.school_id,
      session,
      term,
      quantity,
      price,
      note,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return { error: batchError?.message ?? "Could not create the batch." };
  }

  const pins = generatePins(quantity).map((p) => ({
    school_id: profile.school_id,
    batch_id: batch.id,
    serial: p.serial,
    pin: p.pin,
    session,
    term,
  }));

  const { error: pinsError } = await supabase.from("result_checker_pins").insert(pins);

  if (pinsError) {
    // Extremely unlikely (serial space is ~2.9 x 10^17) but not
    // impossible — the batch row is left in place with zero pins under
    // it rather than partially inserted, so re-running is safe to try.
    return {
      error:
        pinsError.code === "23505"
          ? "A serial collision occurred generating this batch — please try again."
          : pinsError.message,
    };
  }

  revalidatePath("/result-checker");
  return { success: `Generated ${quantity} PIN${quantity === 1 ? "" : "s"} for ${session} · Term ${term}.` };
}
