import { createClient } from "../../../../supabase/server";
import { NextResponse } from "next/server";
import { enqueueEmail } from "@/lib/email-queue";
import WelcomeEmail from "../../../../emails/welcome";
import { completePendingNexusLink } from "@/lib/nexus/pending-link";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirect_to = requestUrl.searchParams.get("redirect_to");

  let nexusDestination: string | null = null;

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    // A pending Nexus link completes only for the same Canvas user (D182 §3).
    if (data?.session?.user) {
      nexusDestination = await completePendingNexusLink(data.session.user.id);
    }

    // Send welcome email for new users (created within last 5 minutes)
    if (data?.session?.user) {
      const user = data.session.user;
      const createdAt = new Date(user.created_at);
      const now = new Date();
      const isNewUser = now.getTime() - createdAt.getTime() < 5 * 60 * 1000;

      if (isNewUser) {
        try {
          const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL || "https://canvas.cyberdelic.design";
          const userName =
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "there";

          await enqueueEmail({
            to: user.email!,
            subject: "Welcome to CXD Canvas!",
            template: WelcomeEmail({
              userName,
              dashboardUrl: `${baseUrl}/dashboard`,
            }),
          });
        } catch (e) {
          console.error("Failed to enqueue welcome email:", e);
        }
      }
    }
  }

  // URL to redirect to after sign in process completes
  // Security: Only allow relative paths to prevent open redirect attacks
  // An explicit destination (e.g. the password-reset page) wins over a
  // completed Nexus link's intent.
  const explicit = redirect_to && redirect_to !== "/dashboard" ? redirect_to : null;
  let redirectTo = explicit || nexusDestination || redirect_to || "/dashboard";
  if (redirectTo.startsWith("//") || redirectTo.startsWith("http:") || redirectTo.startsWith("https:") || !redirectTo.startsWith("/")) {
    redirectTo = "/dashboard";
  }
  return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
}
