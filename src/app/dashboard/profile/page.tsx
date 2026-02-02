import { createClient } from "@/supabase/server";
import { redirect } from "next/navigation";
import { ProfileContent } from "@/components/profile-content";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return <ProfileContent userId={user.id} userEmail={user.email || ""} />;
}
