import Link from "next/link";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { withAuthTimeout } from "@/lib/withAuthTimeout";
import { AcceptInviteButton } from "./AcceptInviteButton";

export default async function ParentInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invitation } = await admin
    .from("parent_invitations")
    .select("expires_at, redeemed_at, students(full_name), schools(name)")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) {
    return (
      <Message title="Invalid link" body="This invitation link doesn't exist. Ask the school for a new one." />
    );
  }

  if (invitation.redeemed_at) {
    return <Message title="Already used" body="This invitation link has already been used." />;
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <Message title="Link expired" body="This invitation link has expired. Ask the school for a new one." />
    );
  }

  const studentName = (invitation.students as unknown as { full_name: string } | null)?.full_name ?? "a student";
  const schoolName = (invitation.schools as unknown as { name: string } | null)?.name ?? "the school";

  const supabase = await createClient();
  const { data } = await withAuthTimeout(supabase.auth.getUser(), 8000, { user: null });
  const user = data.user;

  let isSignedInParent = false;
  if (user) {
    const { data: parentRow } = await supabase.from("parents").select("id").eq("id", user.id).maybeSingle();
    isSignedInParent = !!parentRow;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">You&rsquo;ve been invited</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">
        {schoolName} invited you to link your parent account with <strong>{studentName}</strong>.
      </p>

      {isSignedInParent ? (
        <AcceptInviteButton token={token} />
      ) : (
        <Link
          href={`/parent/login?next=/parent/invite/${token}`}
          className="mt-6 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
        >
          Sign in or create a parent account →
        </Link>
      )}
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">{body}</p>
    </div>
  );
}
