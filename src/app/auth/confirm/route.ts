import { handleAuthEmailLink } from "@/lib/authOtp";

// Where Supabase's signup-confirmation email sends the user back to.
// Staff land on the "create your school" flow; a parent confirming the
// same way lands in the parent portal instead.
export async function GET(request: Request) {
  return handleAuthEmailLink(request, "/onboarding", "/parent");
}
