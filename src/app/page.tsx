import { redirect } from "next/navigation";
import { createClient } from "../../supabase/server";
import { LandingPage } from "@/components/landing-page";

export default async function Home() {
  try {
    const supabase = await createClient();
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null } }>((resolve) =>
        setTimeout(() => resolve({ data: { user: null } }), 3000)
      ),
    ]);
    if (result.data.user) {
      redirect("/dashboard");
    }
  } catch {
    // Auth unavailable - show landing page
  }

  return <LandingPage />;
}
