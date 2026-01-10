import { signInAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Sparkles, LogIn } from "lucide-react";

interface LoginProps {
  searchParams: Promise<Message>;
}

export default async function SignInPage({ searchParams }: LoginProps) {
  const message = await searchParams;

  if ("message" in message) {
    return (
      <div className="flex h-screen w-full flex-1 items-center justify-center p-4 bg-background">
        <FormMessage message={message} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      {/* Header */}
      <Link href="/" className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-lg gradient-border flex items-center justify-center glow-teal">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <span className="text-lg font-semibold text-gradient">CXD Canvas</span>
      </Link>

      <div className="w-full max-w-md rounded-xl gradient-border bg-card/50 backdrop-blur p-8">
        <form className="flex flex-col space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold">
              <span className="text-gradient">Welcome Back</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link
                className="text-primary font-medium hover:underline transition-all"
                href="/sign-up"
              >
                Sign up
              </Link>
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                className="w-full bg-input border-border"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <Link
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-all"
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
                className="w-full bg-input border-border"
              />
            </div>
          </div>

          <SubmitButton
            className="w-full glow-teal"
            pendingText="Signing in..."
            formAction={signInAction}
          >
            <LogIn className="w-4 h-4 mr-2" />
            Sign in
          </SubmitButton>

          <FormMessage message={message} />
        </form>
      </div>
    </div>
  );
}
