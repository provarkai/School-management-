"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface RouteFormState {
  error?: string;
}

export async function createRoute(
  _prevState: RouteFormState,
  formData: FormData
): Promise<RouteFormState> {
  const { profile } = await requireProprietor();
  const name = String(formData.get("name") ?? "").trim();
  const driverName = String(formData.get("driver_name") ?? "").trim() || null;
  const driverPhone = String(formData.get("driver_phone") ?? "").trim() || null;
  const vehicleInfo = String(formData.get("vehicle_info") ?? "").trim() || null;

  if (!name) {
    return { error: "Route name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("bus_routes").insert({
    school_id: profile.school_id,
    name,
    driver_name: driverName,
    driver_phone: driverPhone,
    vehicle_info: vehicleInfo,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `"${name}" is already in the route list.` };
    }
    return { error: error.message };
  }

  revalidatePath("/transport");
  return {};
}

export async function updateRoute(formData: FormData) {
  await requireProprietor();
  const routeId = String(formData.get("route_id"));
  const name = String(formData.get("name") ?? "").trim();
  const driverName = String(formData.get("driver_name") ?? "").trim() || null;
  const driverPhone = String(formData.get("driver_phone") ?? "").trim() || null;
  const vehicleInfo = String(formData.get("vehicle_info") ?? "").trim() || null;

  if (!name) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("bus_routes")
    .update({ name, driver_name: driverName, driver_phone: driverPhone, vehicle_info: vehicleInfo })
    .eq("id", routeId);

  if (error) throw new Error(error.message);
  revalidatePath("/transport");
}

export async function deleteRoute(routeId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("bus_routes").delete().eq("id", routeId);
  if (error) throw new Error(error.message);
  revalidatePath("/transport");
}

export interface StopFormState {
  error?: string;
}

export async function createStop(
  _prevState: StopFormState,
  formData: FormData
): Promise<StopFormState> {
  const { profile } = await requireProprietor();
  const routeId = String(formData.get("route_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const pickupTime = String(formData.get("pickup_time") ?? "").trim() || null;
  const dropTime = String(formData.get("drop_time") ?? "").trim() || null;

  if (!routeId || !name) {
    return { error: "Stop name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("bus_stops").insert({
    school_id: profile.school_id,
    route_id: routeId,
    name,
    pickup_time: pickupTime,
    drop_time: dropTime,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `"${name}" already exists on this route.` };
    }
    return { error: error.message };
  }

  revalidatePath("/transport");
  return {};
}

export async function deleteStop(stopId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("bus_stops").delete().eq("id", stopId);
  if (error) throw new Error(error.message);
  revalidatePath("/transport");
  revalidatePath("/students");
}
