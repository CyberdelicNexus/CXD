import { ShimmerGrid } from "@/components/ui/shimmer-grid";
import { signInAction, signInWithGoogleAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { LogIn } from "lucide-react";
import Image from "next/image";

export const metadata = { title: 'Sign In' };

interface LoginProps {
  searchParams: Promise<Message & { redirectTo?: string }>;
}

export default async function SignInPage({ searchParams }: LoginProps) {
  const message = await searchParams;
  const redirectTo = (message as any).redirectTo as string | undefined;

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
            src="/images/CXD Logo 2.png"
            alt="CXD"
            width={48}
            height={48}
            className="group-hover:scale-110 transition-transform object-contain"
          />
        </Link>

        {/* Form Card */}
        <div className="w-full max-w-md glass-card-glow rounded-2xl p-8">
          <form className="flex flex-col space-y-6">
            {redirectTo && (
              <input type="hidden" name="redirectTo" value={redirectTo} />
            )}
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

            <div className="flex items-center gap-2.5">
              <input
                id="rememberMe"
                name="rememberMe"
                type="checkbox"
                defaultChecked
                className="w-4 h-4 rounded border-white/20 bg-white/5 accent-violet-500 cursor-pointer"
              />
              <Label
                htmlFor="rememberMe"
                className="text-sm text-white/60 cursor-pointer select-none"
              >
                Remember this computer
              </Label>
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

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/40">or continue with</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Google Sign In */}
          <form action={signInWithGoogleAction}>
            {redirectTo && (
              <input type="hidden" name="redirectTo" value={redirectTo} />
            )}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-sm font-medium text-white/80 hover:text-white transition-all"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
