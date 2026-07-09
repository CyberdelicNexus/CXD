import DashboardNavbar from "@/components/dashboard-navbar";
import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import { MasterPlanContent } from "@/components/master-plan-content";
import { ShimmerGrid } from "@/components/ui/shimmer-grid";

export const metadata = { title: "Master Plan" };

export default async function MasterPlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-black">
      <ShimmerGrid
        dotSize={1.5}
        dotSpacing={24}
        baseColor="rgba(110, 56, 236, 0.1)"
        hoverColor="rgba(138, 99, 255, 0.5)"
        hoverSize={400}
        smoothing={60}
      />
      <DashboardNavbar />
      <MasterPlanContent />
    </div>
  );
}
