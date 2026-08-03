import { handleAuthEmailLink } from "@/lib/authOtp";

// Where Supabase's password-recovery email sends the user back to. Both
// staff and parents set their new password on the same screen.
export async function GET(request: Request) {
  return handleAuthEmailLink(request, "/reset-password", "/reset-password");
}
