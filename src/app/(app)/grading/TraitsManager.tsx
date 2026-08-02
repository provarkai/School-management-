"use client";

import { useActionState } from "react";
import { addTrait, deleteTrait, type GradingFormState } from "./actions";

const initialState: GradingFormState = {};

export interface Trait {
  id: string;
  name: string;
  domain: string;
}

const DOMAIN_LABELS: Record<string, string> = {
  affective: "Affective",
  psychomotor: "Psychomotor",
};

export function TraitsManager({ traits }: { traits: Trait[] }) {
  const [state, action, pending] = useActionState(addTrait, initialState);

  const byDomain = (domain: string) => traits.filter((t) => t.domain === domain);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Affective &amp; psychomotor traits</h2>
      <p className="mt-1 text-xs text-zinc-500">
        The behaviour and skills ratings printed beside the academic table, scored 1–5 per
        student each term.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(["affective", "psychomotor"] as const).map((domain) => (
          <div key={domain}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
              {DOMAIN_LABELS[domain]}
            </p>
            {byDomain(domain).length === 0 ? (
              <p className="text-xs text-zinc-400">None yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-100">
                {byDomain(domain).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between px-3 py-1.5 text-sm"
                  >
                    <span className="text-zinc-900">{t.name}</span>
                    <form action={deleteTrait.bind(null, t.id)}>
                      <button
                        type="submit"
                        className="text-xs font-medium text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {state.error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-zinc-700">
          Trait
          <input
            name="name"
            required
            placeholder="e.g. Punctuality"
            className="mt-1 block w-48 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Domain
          <select
            name="domain"
            defaultValue="affective"
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="affective">Affective</option>
            <option value="psychomotor">Psychomotor</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </form>
    </section>
  );
}
