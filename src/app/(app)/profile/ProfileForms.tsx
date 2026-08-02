"use client";

import { useActionState, useState } from "react";
import {
  changeOwnPassword,
  updateOwnProfile,
  updateSchoolProfile,
  updateAcademicSession,
  updateQuickLinks,
  updateDashboardWidgets,
  type ProfileFormState,
} from "./actions";
import type { Term } from "@/lib/types";
import { QUICK_LINK_CATALOG, MAX_QUICK_LINKS } from "@/lib/quickLinks";
import { DASHBOARD_WIDGET_CATALOG, DEFAULT_DASHBOARD_WIDGETS } from "@/lib/dashboardWidgets";
import { PasswordInput } from "@/components/PasswordInput";

const initialState: ProfileFormState = {};

export function SchoolProfileForm({
  name,
  address,
  phone,
}: {
  name: string;
  address: string | null;
  phone: string | null;
}) {
  const [state, action, pending] = useActionState(updateSchoolProfile, initialState);

  return (
    <form action={action} className="max-w-sm space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      <label className="block text-sm font-medium text-zinc-700">
        School name
        <input
          name="school_name"
          defaultValue={name}
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Address
        <input
          name="school_address"
          defaultValue={address ?? ""}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        School phone
        <input
          name="school_phone"
          type="tel"
          defaultValue={phone ?? ""}
          placeholder="+234…"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <span className="mt-1 block text-xs font-normal text-zinc-400">
          Shown to parents on their dashboard as a number to call the school office.
        </span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function AcademicSessionForm({ session, term }: { session: string; term: Term }) {
  const [state, action, pending] = useActionState(updateAcademicSession, initialState);

  return (
    <form action={action} className="flex max-w-sm flex-wrap items-end gap-3">
      <div className="w-full">
        {state.error && (
          <p className="mb-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
        {state.success && (
          <p className="mb-1 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.success}
          </p>
        )}
      </div>
      <label className="text-sm font-medium text-zinc-700">
        Session
        <input
          name="current_session"
          defaultValue={session}
          placeholder="2025/2026"
          required
          className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700">
        Term
        <select
          name="current_term"
          defaultValue={term}
          className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="1">1st Term</option>
          <option value="2">2nd Term</option>
          <option value="3">3rd Term</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function QuickLinksForm({ selected }: { selected: string[] }) {
  const [state, action, pending] = useActionState(updateQuickLinks, initialState);
  const [checked, setChecked] = useState<string[]>(selected);

  function toggle(key: string) {
    setChecked((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length < MAX_QUICK_LINKS
          ? [...prev, key]
          : prev
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      <p className="text-sm text-zinc-500">
        Pick up to {MAX_QUICK_LINKS} shortcuts to show on the dashboard ({checked.length}/
        {MAX_QUICK_LINKS} selected).
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {QUICK_LINK_CATALOG.map((option) => {
          const isChecked = checked.includes(option.key);
          const disabled = !isChecked && checked.length >= MAX_QUICK_LINKS;
          return (
            <label
              key={option.key}
              className={`flex items-center gap-2 text-sm ${
                disabled ? "text-zinc-300" : "text-zinc-700"
              }`}
            >
              <input
                type="checkbox"
                name="quick_links"
                value={option.key}
                checked={isChecked}
                disabled={disabled}
                onChange={() => toggle(option.key)}
                className="rounded border-zinc-300"
              />
              {option.label}
            </label>
          );
        })}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function DashboardWidgetsForm({ selected }: { selected: string[] }) {
  const [state, action, pending] = useActionState(updateDashboardWidgets, initialState);
  const [order, setOrder] = useState<string[]>(
    selected.length > 0 ? selected : DEFAULT_DASHBOARD_WIDGETS
  );
  const [visible, setVisible] = useState<Set<string>>(
    new Set(selected.length > 0 ? selected : DEFAULT_DASHBOARD_WIDGETS)
  );

  function toggle(key: string) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function move(key: string, direction: -1 | 1) {
    setOrder((prev) => {
      const index = prev.indexOf(key);
      // Swap with the next *visible* entry in that direction, not just the
      // physically adjacent one — otherwise moving "up" past a hidden
      // widget silently reorders nothing the user can see.
      let swapWith = index + direction;
      while (swapWith >= 0 && swapWith < prev.length && !visible.has(prev[swapWith])) {
        swapWith += direction;
      }
      if (swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next;
    });
  }

  const orderedVisible = order.filter((key) => visible.has(key));

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      <p className="text-sm text-zinc-500">
        Choose which sections show on the dashboard, and reorder them top to bottom.
      </p>
      <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
        {order.map((key) => {
          const option = DASHBOARD_WIDGET_CATALOG.find((o) => o.key === key);
          if (!option) return null;
          const isVisible = visible.has(key);
          const visibleIndex = orderedVisible.indexOf(key);
          return (
            <li key={key} className="flex items-center justify-between gap-3 px-3 py-2">
              <label className={`flex items-center gap-2 text-sm ${isVisible ? "text-zinc-700" : "text-zinc-400"}`}>
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={() => toggle(key)}
                  className="rounded border-zinc-300"
                />
                {option.label}
              </label>
              {isVisible && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={visibleIndex <= 0}
                    onClick={() => move(key, -1)}
                    className="rounded border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={visibleIndex >= orderedVisible.length - 1}
                    onClick={() => move(key, 1)}
                    className="rounded border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {orderedVisible.map((key) => (
        <input key={key} type="hidden" name="widgets" value={key} />
      ))}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function EditProfileForm({ name, phone }: { name: string; phone: string | null }) {
  const [state, action, pending] = useActionState(updateOwnProfile, initialState);

  return (
    <form action={action} className="max-w-sm space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      <label className="block text-sm font-medium text-zinc-700">
        Full name
        <input
          name="name"
          defaultValue={name}
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Phone
        <input
          name="phone"
          defaultValue={phone ?? ""}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPassword, initialState);

  return (
    <form action={action} className="max-w-sm space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      <label className="block text-sm font-medium text-zinc-700">
        New password
        <PasswordInput
          name="password"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <span className="mt-1 block text-xs font-normal text-zinc-400">At least 8 characters</span>
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Confirm new password
        <PasswordInput
          name="confirm_password"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
