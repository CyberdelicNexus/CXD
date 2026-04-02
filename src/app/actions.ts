"use server";

import { encodedRedirect } from "@/utils/utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createSessionClient } from "../../supabase/server";

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const fullName = formData.get("full_name")?.toString() || '';
  const promo = formData.get("promo")?.toString();
  const redirectTo = formData.get("redirectTo")?.toString();
  const supabase = await createClient();
  const origin = headers().get("origin");

  if (!email || !password) {
    return encodedRedirect(
      "error",
      "/sign-up",
      "Email and password are required",
    );
  }

  const { data: { user }, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''}`,
      data: {
        full_name: fullName,
        email: email,
        promo: promo,
      }
    },
  });

  if (error) {
    console.error(`Signup error [${error.code}]: ${error.message}`);

    // Check for specific database-related errors that might be cryptic to the user
    if (error.message.includes("Database error saving new user")) {
      return encodedRedirect(
        "error",
        "/sign-up",
        "Our database is experiencing a temporary issue. Please try signing up again in a few moments."
      );
    }

    return encodedRedirect("error", "/sign-up", error.message);
  }

  // Note: The public.users and public.subscriptions records are created 
  // automatically by the on_auth_user_created trigger in the database.
  // We no longer need to manually insert them here.

  return encodedRedirect(
    "success",
    "/sign-up",
    "Thanks for signing up! Please check your email for a verification link.",
  );
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = formData.get("redirectTo") as string | null;
  const rememberMe = formData.get("rememberMe") === "on";
  const supabase = rememberMe ? await createClient() : await createSessionClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const params = redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : "";
    return encodedRedirect("error", `/sign-in${params}`, error.message);
  }

  return redirect(redirectTo || "/dashboard");
};

export const signInWithGoogleAction = async (formData: FormData) => {
  const supabase = await createClient();
  const origin = headers().get("origin");
  const redirectTo = formData.get("redirectTo") as string | null;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ""}`,
    },
  });

  if (error) {
    return encodedRedirect("error", "/sign-in", error.message);
  }

  if (data.url) {
    return redirect(data.url);
  }
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const origin = headers().get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return encodedRedirect(
      "error",
      "/forgot-password",
      "Could not reset password",
    );
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for a link to reset your password.",
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password and confirm password are required",
    );
  }

  if (password !== confirmPassword) {
    encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Passwords do not match",
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password update failed",
    );
  }

  encodedRedirect("success", "/protected/reset-password", "Password updated");
};

export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/");
};

export const updateNameAction = async (formData: FormData) => {
  const fullName = formData.get("full_name")?.toString();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return encodedRedirect("error", "/dashboard/profile", "Not authenticated");
  }

  if (!fullName) {
    return encodedRedirect("error", "/dashboard/profile", "Name is required");
  }

  const { error } = await supabase
    .from('users')
    .update({
      full_name: fullName,
      name: fullName
    })
    .eq('id', user.id);

  if (error) {
    return encodedRedirect("error", "/dashboard/profile", "Failed to update name");
  }

  revalidatePath("/dashboard/profile");
  return encodedRedirect("success", "/dashboard/profile", "Name updated successfully");
};

export const deleteAccountAction = async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Need a service role client to delete the user from auth.users
  const adminClient = await createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(user.id);

  if (error) {
    console.error("Delete account error:", error);
    return encodedRedirect("error", "/dashboard/profile", "Failed to delete account. Please contact support.");
  }

  // Sign out locally too
  await supabase.auth.signOut();

  return redirect("/");
};

export const cancelSubscriptionAction = async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Update subscription to 'free'
  const { error } = await supabase
    .from('subscriptions')
    .update({
      plan_id: 'free',
      status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id);

  if (error) {
    return encodedRedirect("error", "/dashboard/profile", "Failed to cancel subscription");
  }

  revalidatePath("/dashboard/profile");
  return encodedRedirect("success", "/dashboard/profile", "Subscription cancelled. You are now on the Free tier.");
};

// Helper to create an admin client
async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}