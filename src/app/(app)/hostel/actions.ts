"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface HostelFormState {
  error?: string;
}

export async function createHostel(
  _prevState: HostelFormState,
  formData: FormData
): Promise<HostelFormState> {
  const { profile } = await requireProprietor();
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;

  if (!name) {
    return { error: "Hostel name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("hostels").insert({
    school_id: profile.school_id,
    name,
    address,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `"${name}" is already in the hostel list.` };
    }
    return { error: error.message };
  }

  revalidatePath("/hostel");
  return {};
}

export async function renameHostel(formData: FormData) {
  await requireProprietor();
  const hostelId = String(formData.get("hostel_id"));
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;

  if (!name) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("hostels")
    .update({ name, address })
    .eq("id", hostelId);

  if (error) throw new Error(error.message);
  revalidatePath("/hostel");
}

export async function deleteHostel(hostelId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("hostels").delete().eq("id", hostelId);
  if (error) throw new Error(error.message);
  revalidatePath("/hostel");
}

export async function updateHostelWarden(formData: FormData) {
  await requireProprietor();
  const hostelId = String(formData.get("hostel_id"));
  const wardenId = String(formData.get("warden_id") ?? "") || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("hostels")
    .update({ warden_id: wardenId })
    .eq("id", hostelId);

  if (error) throw new Error(error.message);
  revalidatePath("/hostel");
}

export interface RoomFormState {
  error?: string;
}

export async function createRoom(
  _prevState: RoomFormState,
  formData: FormData
): Promise<RoomFormState> {
  const { profile } = await requireProprietor();
  const hostelId = String(formData.get("hostel_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const capacity = Number(formData.get("capacity") ?? 0) || null;

  if (!hostelId || !name) {
    return { error: "Room name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("hostel_rooms").insert({
    school_id: profile.school_id,
    hostel_id: hostelId,
    name,
    capacity,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `"${name}" already exists in this hostel.` };
    }
    return { error: error.message };
  }

  revalidatePath("/hostel");
  return {};
}

export async function deleteRoom(roomId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("hostel_rooms").delete().eq("id", roomId);
  if (error) throw new Error(error.message);
  revalidatePath("/hostel");
  revalidatePath("/students");
}
