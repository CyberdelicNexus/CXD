import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShimmerGrid } from "@/components/ui/shimmer-grid";
import { resetPasswordAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "../../../supabase/server";
import { AlertTriangle, KeyRound } from "lucide-react";

export const metadata = { title: "Reset Password" };

// Shared auth shell — identical background/logo/card to sign-in and sign-up.
function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      <ShimmerGrid
        dotSize={1.5}
        dotSpacing={24}
        baseColor="rgba(110, 56, 236, 0.1)"
        hoverColor="rgba(138, 99, 255, 0.5)"
        hoverSize={400}
        smoothing={60}
      />
      <div className="fixed inset-0 hero-gradient pointer-events-none" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-8">
        <Link href="/" className="mb-8 group">
          <Image
            src="/images/CXD Logo 2.png"
            alt="CXD"
            width={48}
            height={48}
            className="group-hover:scale-110 transition-transform object-contain"
          />
        </Link>

        <div className="w-full max-w-md glass-card-glow rounded-2xl p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

export default async function ResetPassword(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;

  // The reset form is only usable with an active recovery session (set by the
  // /auth/callback code exchange). If it's missing/expired, show a recovery
  // prompt instead of a form that would fail on submit.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">
              <span className="text-gradient-purple">Reset link expired</span>
            </h1>
            <p className="text-white/60 text-sm leading-relaxed">
              This password reset link is invalid or has expired. Reset links can
              only be used once and are valid for a limited time.
            </p>
          </div>

          <div className="w-full pt-4 border-t border-white/10">
            <Link href="/forgot-password" className="block w-full">
              <button className="btn-primary-glow w-full flex items-center justify-center gap-2">
                Request a new link
              </button>
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form className="flex flex-col space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">
            <span className="text-gradient-purple">Reset Password</span>
          </h1>
          <p className="text-sm text-white/50">
            Choose a new password for your account.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-white/70">
              New password
            </Label>
            <Input
              id="password"
              type="password"
              name="password"
              placeholder="New password"
              minLength={8}
              required
              className="w-full bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500/50 focus:ring-violet-500/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium text-white/70">
              Confirm password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              placeholder="Confirm password"
              minLength={8}
              required
              className="w-full bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500/50 focus:ring-violet-500/20"
            />
          </div>
        </div>

        <SubmitButton
          formAction={resetPasswordAction}
          pendingText="Resetting password..."
          className="btn-primary-glow w-full flex items-center justify-center gap-2"
        >
          <KeyRound className="w-4 h-4" />
          Reset password
        </SubmitButton>

        <FormMessage message={searchParams} />
      </form>
    </AuthShell>
  );
}
