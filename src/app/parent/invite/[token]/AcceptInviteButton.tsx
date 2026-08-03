"use client";

import { useActionState } from "react";
import { acceptInvitation, type AcceptInviteState } from "./actions";

const initialState: AcceptInviteState = {};

export function AcceptInviteButton({ token }: { token: string }) {
  const action = acceptInvitation.bind(null, token);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-6">
      {state.error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Linking…" : "Link my account"}
      </button>
    </form>
  );
}
