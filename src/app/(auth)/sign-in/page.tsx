import { ShimmerGrid } from "@/components/ui/shimmer-grid";
import { signInAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { LogIn } from "lucide-react";
import Image from "next/image";

interface LoginProps {
  searchParams: Promise<Message>;
}

export default async function SignInPage({ searchParams }: LoginProps) {
  const message = await searchParams;

  if ("message" in message) {
    return (
      <div className="flex h-screen w-full flex-1 items-center justify-center p-4 bg-black">
        <div className="glass-card p-6 rounded-xl">
          <FormMessage message={message} />
        </div>
      </div>
    );
  }

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
      <div className="fixed inset-0 hero-gradient pointer-events-none" />


      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-8">
        {/* Logo */}
        <Link href="/" className="mb-8 group">
          <Image
            src="/images/hypercube-logo.webp"
            alt="CXD"
            width={48}
            height={48}
            className="group-hover:scale-110 transition-transform object-contain"
          />
        </Link>

        {/* Form Card */}
        <div className="w-full max-w-md glass-card-glow rounded-2xl p-8">
          <form className="flex flex-col space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-bold">
                <span className="text-gradient-purple">Welcome Back</span>
              </h1>
              <p className="text-sm text-white/50">
                Don't have an account?{" "}
                <Link
                  className="text-violet-400 font-medium hover:text-violet-300 transition-colors"
                  href="/sign-up"
                >
                  Sign up
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

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-sm font-medium text-white/70">
                    Password
                  </Label>
                  <Link
                    className="text-xs text-white/40 hover:text-violet-400 transition-colors"
                    href="/forgot-password"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  name="password"
                  placeholder="Your password"
                  required
                  className="w-full bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500/50 focus:ring-violet-500/20"
                />
              </div>
            </div>

            <SubmitButton
              className="btn-primary-glow w-full flex items-center justify-center gap-2"
              pendingText="Signing in..."
              formAction={signInAction}
            >
              <LogIn className="w-4 h-4" />
              Sign in
            </SubmitButton>

            <FormMessage message={message} />
          </form>
        </div>
      </div>
    </div>
  );
}
