import { handleAuthEmailLink } from "@/lib/authOtp";

// Where Supabase's password-recovery email sends the user back to.
export async function GET(request: Request) {
  return handleAuthEmailLink(request, "/reset-password");
}
