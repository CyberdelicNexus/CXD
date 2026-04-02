import DashboardNavbar from "@/components/dashboard-navbar";
import { redirect } from "next/navigation";
import { createClient } from "../../../supabase/server";
import { DashboardContent } from "@/components/dashboard-content";
import { ShimmerGrid } from "@/components/ui/shimmer-grid";

export default async function Dashboard() {
  const supabase = await createClient();

  const result = await Promise.race([
    supabase.auth.getUser(),
    new Promise<{ data: { user: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { user: null } }), 3000)
    ),
  ]);
  const user = result.data.user;

  if (!user) {
    return redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Interactive Shimmer Grid Background - covers entire viewport including navbar */}
      <ShimmerGrid
        dotSize={1.5}
        dotSpacing={24}
        baseColor="rgba(110, 56, 236, 0.1)"
        hoverColor="rgba(138, 99, 255, 0.5)"
        hoverSize={400}
        smoothing={60}
      />
      <DashboardNavbar />
      <DashboardContent userId={user.id} userEmail={user.email || ''} />
    </div>
  );
}
