import { ShimmerGrid } from "@/components/ui/shimmer-grid";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import Image from "next/image";
import { forgotPasswordAction } from "@/app/actions";
import { UrlProvider } from "@/components/url-provider";
import { ArrowRight, Mail } from "lucide-react";

export const metadata = { title: 'Reset Password' };

export default async function ForgotPassword(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  const isSuccess = "success" in searchParams || "message" in searchParams;

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Background elements — matches sign-in / sign-up */}
      <ShimmerGrid
        dotSize={1.5}
        dotSpacing={24}
        baseColor="rgba(110, 56, 236, 0.1)"
        hoverColor="rgba(138, 99, 255, 0.5)"
        hoverSize={400}
        smoothing={60}
      />
      <div className="fixed inset-0 hero-gradient pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-8">
        {/* Logo */}
        <Link href="/" className="mb-8 group">
          <Image
            src="/images/CXD Logo 2.png"
            alt="CXD"
            width={48}
            height={48}
            className="group-hover:scale-110 transition-transform object-contain"
          />
        </Link>

        {/* Form Card */}
        <div className="w-full max-w-md glass-card-glow rounded-2xl p-8">
          {isSuccess ? (
            // Success State — email sent
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Mail className="w-8 h-8 text-emerald-400" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold">
                  <span className="text-gradient-purple">Check Your Email</span>
                </h1>
                <p className="text-white/60 text-sm leading-relaxed">
                  {"success" in searchParams && searchParams.success}
                  {"message" in searchParams && searchParams.message}
                </p>
              </div>

              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                <Mail className="w-5 h-5 text-violet-400" />
                <span className="text-sm text-white/70">
                  Click the link in your email to reset your password
                </span>
              </div>

              <div className="w-full pt-4 border-t border-white/10">
                <Link href="/sign-in" className="block w-full">
                  <button className="btn-primary-glow w-full flex items-center justify-center gap-2">
                    Back to Sign In
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              </div>

              <p className="text-white/40 text-xs">
                Didn't receive the email? Check your spam folder or{" "}
                <Link href="/forgot-password" className="text-violet-400 hover:text-violet-300">
                  try again
                </Link>
              </p>
            </div>
          ) : (
            // Normal Form State
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
          )}
        </div>
      </div>
    </div>
  );
}
