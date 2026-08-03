"use client";

import { useActionState, useState } from "react";
import { createParentInvitation, revokeParentInvitation, type InviteFormState } from "./inviteActions";
import { ShareLinkButton } from "./ShareLinkButton";

const initialState: InviteFormState = {};

export interface ParentInvitation {
  id: string;
  created_at: string;
  expires_at: string;
  redeemed_at: string | null;
}

export function ParentInviteSection({
  studentId,
  invitations,
}: {
  studentId: string;
  invitations: ParentInvitation[];
}) {
  const action = createParentInvitation.bind(null, studentId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [revoking, setRevoking] = useState<string | null>(null);

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Invite a parent</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Generate a one-time link and send it to the parent/guardian any way you like (SMS,
          WhatsApp, print). Whoever opens it can sign in or create a parent account and link it to
          this student — no email match needed.
        </p>
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.url && <ShareLinkButton url={state.url} label="Copy invite link" />}

      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate invite link"}
        </button>
      </form>

      {invitations.length > 0 && (
        <div className="space-y-1.5 border-t border-zinc-100 pt-3">
          {invitations.map((inv) => {
            const expired = !inv.redeemed_at && new Date(inv.expires_at) < new Date();
            return (
              <div key={inv.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-zinc-500">
                  {inv.redeemed_at
                    ? `Redeemed ${new Date(inv.redeemed_at).toLocaleDateString()}`
                    : expired
                      ? "Expired"
                      : `Pending — expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                </span>
                {!inv.redeemed_at && (
                  <button
                    type="button"
                    disabled={revoking === inv.id}
                    onClick={async () => {
                      setRevoking(inv.id);
                      await revokeParentInvitation(studentId, inv.id);
                      setRevoking(null);
                    }}
                    className="font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
