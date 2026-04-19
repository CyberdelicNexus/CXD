import { ShimmerGrid } from "@/components/ui/shimmer-grid";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { signUpAction } from "@/app/actions";
import { UrlProvider } from "@/components/url-provider";
import { HypercubeLogo } from "@/components/icons/hypercube-logo";
import { ArrowRight, CheckCircle, Mail, Shield } from "lucide-react";
import Image from "next/image";

export const metadata = { title: 'Sign Up' };

type SearchParams = {
  success?: string;
  error?: string;
  message?: string;
  plan?: string;
  promo?: string;
  redirectTo?: string;
};

export default async function Signup(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = (await props.searchParams) as SearchParams;

  // Check if this is a success message (email confirmation sent)
  const isSuccess = "success" in searchParams || "message" in searchParams;

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Background elements */}
      <ShimmerGrid
        dotSize={1.5}
        dotSpacing={24}
        baseColor="rgba(110, 56, 236, 0.1)"
        hoverColor="rgba(138, 99, 255, 0.5)"
        hoverSize={400}
        smoothing={60}
      />

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
            // Success State - Hide form, show confirmation
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
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
                  Click the link in your email to verify your account
                </span>
              </div>

              <div className="w-full pt-4 border-t border-white/10">
                <Link href="/sign-in" className="block w-full">
                  <button className="btn-primary-glow w-full flex items-center justify-center gap-2">
                    Go to Login
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              </div>

              <p className="text-white/40 text-xs">
                Didn't receive the email? Check your spam folder or{" "}
                <Link href="/sign-up" className="text-violet-400 hover:text-violet-300">
                  try again
                </Link>
              </p>
            </div>
          ) : "error" in searchParams ? (
            // Error State
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="text-3xl">⚠️</span>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-red-400">
                  Something went wrong
                </h1>
                <p className="text-white/60 text-sm">
                  {searchParams.error}
                </p>
              </div>

              <Link href="/sign-up" className="block w-full">
                <button className="btn-secondary w-full">
                  Try Again
                </button>
              </Link>
            </div>
          ) : (
            // Normal Form State
            <UrlProvider>
              <form className="flex flex-col space-y-6">
                <div className="space-y-2 text-center">
                  <h1 className="text-3xl font-bold">
                    <span className="text-gradient-purple">Start Your Journey</span>
                  </h1>
                  <p className="text-sm text-white/50">
                    Already have an account?{" "}
                    <Link
                      className="text-violet-400 font-medium hover:text-violet-300 transition-colors"
                      href="/sign-in"
                    >
                      Sign in
                    </Link>
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Promo Code / Beta Access Info */}
                  {searchParams.redirectTo && (
                    <input type="hidden" name="redirectTo" value={searchParams.redirectTo} />
                  )}
                  {(searchParams.plan === 'beta' || searchParams.promo === 'beta') && (
                    <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center gap-3 mb-2 animate-in fade-in slide-in-from-top-2 duration-500">
                      <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4 text-violet-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-violet-400 uppercase tracking-wider">Beta Access Enabled</p>
                        <p className="text-[10px] text-white/50">You will receive a Beta Tester subscription automatically.</p>
                      </div>
                      <input type="hidden" name="promo" value="beta" />
                    </div>
                  )}

                  {/* Manual Promo Support (if any other promo) */}
                  {(searchParams.promo && searchParams.promo !== 'beta') && (
                    <input type="hidden" name="promo" value={searchParams.promo} />
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="full_name" className="text-sm font-medium text-white/70">
                      Full Name
                    </Label>
                    <Input
                      id="full_name"
                      name="full_name"
                      type="text"
                      placeholder="John Doe"
                      required
                      className="w-full bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500/50 focus:ring-violet-500/20"
                    />
                  </div>

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

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-white/70">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      name="password"
                      placeholder="Your password"
                      minLength={6}
                      required
                      className="w-full bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500/50 focus:ring-violet-500/20"
                    />
                  </div>
                </div>

                <SubmitButton
                  formAction={signUpAction}
                  pendingText="Creating account..."
                  className="btn-primary-glow w-full flex items-center justify-center gap-2"
                >
                  <HypercubeLogo size={16} />
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </SubmitButton>
              </form>
            </UrlProvider>
          )}
        </div>
      </div>
    </div>
  );
}
