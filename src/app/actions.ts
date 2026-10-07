"use server";

import { encodedRedirect } from "@/utils/utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createSessionClient } from "../../supabase/server";
import { getSupabaseAdmin } from "@/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limiter";

export const signUpAction = async (formData: FormData) => {
  const headersList = headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rateCheck = checkRateLimit(ip, 'sign-up');
  if (!rateCheck.allowed) {
    return encodedRedirect("error", "/sign-up", "Too many attempts. Please try again later.");
  }

  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const fullName = formData.get("full_name")?.toString() || '';
  const promo = formData.get("promo")?.toString();
  const redirectTo = formData.get("redirectTo")?.toString();
  const supabase = await createClient();
  const origin = headersList.get("origin");

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
  const headersList = headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rateCheck = checkRateLimit(ip, 'sign-in');
  if (!rateCheck.allowed) {
    return encodedRedirect("error", "/sign-in", "Too many attempts. Please try again later.");
  }

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
    // When the auth server times out or fails (e.g. the database is overloaded)
    // supabase-js can hand back a message of "{}" or nothing, which used to be
    // shown to the user verbatim. Say what is actually going on instead.
    const msg = (error.message || "").trim();
    const unreachable = !msg || msg === "{}" || ((error as { status?: number }).status ?? 0) >= 500;
    return encodedRedirect(
      "error",
      `/sign-in${params}`,
      unreachable
        ? "We can't reach the sign-in service right now. Your data is safe. Please try again in a few minutes."
        : msg,
    );
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
  const headersList = headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rateCheck = checkRateLimit(ip, 'forgot-password');
  if (!rateCheck.allowed) {
    return encodedRedirect("error", "/forgot-password", "Too many attempts. Please try again later.");
  }

  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const origin = headersList.get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/dashboard/reset-password`,
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

  // A valid recovery session must exist (established by the /auth/callback code
  // exchange). Without it, updateUser would fail with an opaque error — so we
  // check up front and send the user back to request a fresh link.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return encodedRedirect(
      "error",
      "/forgot-password",
      "Your reset link is invalid or has expired. Please request a new one.",
    );
  }

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password and confirm password are required",
    );
  }

  if (password !== confirmPassword) {
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Passwords do not match",
    );
  }

  if (password.length < 8) {
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password must be at least 8 characters.",
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    // Surface the real reason (too weak, leaked password, same-as-old, etc.)
    // instead of a generic message the user can't act on.
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      error.message || "Password update failed. Please try again.",
    );
  }

  // Security: revoke every OTHER session so a password reset boots any attacker
  // who may already hold a session. The current recovery session is preserved,
  // so the user stays signed in and lands on their dashboard.
  await supabase.auth.signOut({ scope: "others" });

  return encodedRedirect(
    "success",
    "/dashboard",
    "Your password has been updated.",
  );
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
  const adminClient = getSupabaseAdmin();
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

