"use client";

import { useState } from "react";
import { updateRoute, deleteRoute } from "./actions";
import { NewStopForm } from "./NewStopForm";
import { StopRow } from "./StopRow";

export function RouteCard({
  route,
  stops,
  ridersByStop,
}: {
  route: {
    id: string;
    name: string;
    driver_name: string | null;
    driver_phone: string | null;
    vehicle_info: string | null;
  };
  stops: { id: string; name: string; pickup_time: string | null; drop_time: string | null }[];
  ridersByStop: Map<string, number>;
}) {
  const [editing, setEditing] = useState(false);

  const totalRiders = stops.reduce((sum, s) => sum + (ridersByStop.get(s.id) ?? 0), 0);

  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      {editing ? (
        <form
          action={async (formData) => {
            await updateRoute(formData);
            setEditing(false);
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end"
        >
          <input type="hidden" name="route_id" value={route.id} />
          <label className="text-xs font-medium text-zinc-700">
            Name
            <input
              name="name"
              defaultValue={route.name}
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </label>
          <label className="text-xs font-medium text-zinc-700">
            Driver name
            <input
              name="driver_name"
              defaultValue={route.driver_name ?? ""}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </label>
          <label className="text-xs font-medium text-zinc-700">
            Driver phone
            <input
              name="driver_phone"
              defaultValue={route.driver_phone ?? ""}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </label>
          <label className="text-xs font-medium text-zinc-700">
            Vehicle
            <input
              name="vehicle_info"
              defaultValue={route.vehicle_info ?? ""}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </label>
          <div className="flex gap-3 sm:col-span-4">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">{route.name}</h2>
            <p className="text-xs text-zinc-500">
              {route.driver_name ?? "No driver set"}
              {route.driver_phone ? ` · ${route.driver_phone}` : ""}
              {route.vehicle_info ? ` · ${route.vehicle_info}` : ""}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {stops.length} stop{stops.length === 1 ? "" : "s"} · {totalRiders} student
              {totalRiders === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
            >
              Edit
            </button>
            <form action={deleteRoute.bind(null, route.id)}>
              <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
                Remove
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-zinc-100">
        <table className="min-w-full divide-y divide-zinc-100 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium text-zinc-500">Stop</th>
              <th className="px-3 py-1.5 text-left font-medium text-zinc-500">Pickup</th>
              <th className="px-3 py-1.5 text-left font-medium text-zinc-500">Drop</th>
              <th className="px-3 py-1.5 text-left font-medium text-zinc-500">Riders</th>
              <th className="px-3 py-1.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {stops.map((stop) => (
              <StopRow key={stop.id} stop={stop} riders={ridersByStop.get(stop.id) ?? 0} />
            ))}
            {stops.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-3 text-center text-zinc-400">
                  No stops yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <NewStopForm routeId={route.id} />
    </section>
  );
}
