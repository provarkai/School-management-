import { handleAuthEmailLink } from "@/lib/authOtp";

// Where Supabase's signup-confirmation email sends the user back to.
export async function GET(request: Request) {
  return handleAuthEmailLink(request, "/onboarding");
}
