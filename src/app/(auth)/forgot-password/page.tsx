import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { forgotPasswordAction } from "@/app/actions";
import { UrlProvider } from "@/components/url-provider";
import { HypercubeLogo } from "@/components/icons/hypercube-logo";
import { Mail } from "lucide-react";

export const metadata = { title: 'Reset Password' };

export default async function ForgotPassword(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;

  if ("message" in searchParams) {
    return (
      <div className="flex h-screen w-full flex-1 items-center justify-center p-4 bg-black">
        <div className="glass-card p-6 rounded-xl">
          <FormMessage message={searchParams} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Background elements */}
      <div className="fixed inset-0 grid-bg pointer-events-none" />
      <div className="fixed inset-0 hero-gradient pointer-events-none" />

      {/* Decorative orbs */}
      <div className="glow-orb" style={{ top: '30%', left: '15%', opacity: 0.4 }} />
      <div className="glow-orb glow-orb-cyan" style={{ bottom: '30%', right: '15%', opacity: 0.3 }} />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 mb-8 group">
          <HypercubeLogo size={32} className="group-hover:scale-110 transition-transform" />
          <span className="text-xl font-semibold">CXD Canvas</span>
        </Link>

        {/* Form Card */}
        <div className="w-full max-w-md glass-card-glow rounded-2xl p-8">
          <UrlProvider>
            <form className="flex flex-col space-y-6">
              <div className="space-y-2 text-center">
                <h1 className="text-3xl font-bold">
                  <span className="text-gradient-purple">Reset Password</span>
                </h1>
                <p className="text-sm text-white/50">
                  Remember your password?{" "}
                  <Link
                    className="text-violet-400 font-medium hover:text-violet-300 transition-colors"
                    href="/sign-in"
                  >
                    Sign in
                  </Link>
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-white/70">
                    Email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    className="w-full bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500/50 focus:ring-violet-500/20"
                  />
                </div>
              </div>

              <SubmitButton
                formAction={forgotPasswordAction}
                pendingText="Sending reset link..."
                className="btn-primary-glow w-full flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Send Reset Link
              </SubmitButton>

              <FormMessage message={searchParams} />
            </form>
          </UrlProvider>
        </div>

        {/* Footer text */}
        <p className="text-white/30 text-sm mt-6">
          We'll send you a link to reset your password
        </p>
      </div>
    </div>
  );
}
