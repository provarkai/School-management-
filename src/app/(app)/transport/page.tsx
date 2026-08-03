import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { NewRouteForm } from "./NewRouteForm";
import { RouteCard } from "./RouteCard";

export default async function TransportPage() {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const [{ data: routes }, { data: stops }, { data: students }] = await Promise.all([
    supabase
      .from("bus_routes")
      .select("id, name, driver_name, driver_phone, vehicle_info")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    supabase
      .from("bus_stops")
      .select("id, route_id, name, pickup_time, drop_time")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    supabase
      .from("students")
      .select("bus_stop_id")
      .eq("school_id", profile.school_id ?? "")
      .eq("status", "active")
      .not("bus_stop_id", "is", null),
  ]);

  const stopsByRoute = new Map<
    string,
    { id: string; name: string; pickup_time: string | null; drop_time: string | null }[]
  >();
  for (const stop of stops ?? []) {
    const list = stopsByRoute.get(stop.route_id) ?? [];
    list.push(stop);
    stopsByRoute.set(stop.route_id, list);
  }

  const ridersByStop = new Map<string, number>();
  for (const s of students ?? []) {
    if (!s.bus_stop_id) continue;
    ridersByStop.set(s.bus_stop_id, (ridersByStop.get(s.bus_stop_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Transport</h1>
        <p className="text-sm text-zinc-500">
          Manage bus routes and stops, with driver and vehicle details. Assign a student to a stop
          from their student record page. To charge for a seat, create a &ldquo;Transport
          Fee&rdquo; fee type in Fees.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <NewRouteForm />
      </section>

      <div className="space-y-4">
        {(routes ?? []).map((route) => (
          <RouteCard
            key={route.id}
            route={route}
            stops={stopsByRoute.get(route.id) ?? []}
            ridersByStop={ridersByStop}
          />
        ))}
        {(routes ?? []).length === 0 && (
          <p className="rounded-lg border border-zinc-200 bg-white p-5 text-center text-sm text-zinc-400 shadow-sm">
            No routes yet — add your first one above.
          </p>
        )}
      </div>
    </div>
  );
}
