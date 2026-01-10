import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { SmtpMessage } from "../smtp-message";
import { signUpAction } from "@/app/actions";
import { UrlProvider } from "@/components/url-provider";
import { Sparkles } from "lucide-react";

export default async function Signup(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  if ("message" in searchParams) {
    return (
      <div className="flex h-screen w-full flex-1 items-center justify-center p-4 bg-background">
        <FormMessage message={searchParams} />
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
        <UrlProvider>
          <form className="flex flex-col space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-bold">
                <span className="text-gradient">Start Your Journey</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  className="text-primary font-medium hover:underline transition-all"
                  href="/sign-in"
                >
                  Sign in
                </Link>
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-sm font-medium">
                  Full Name
                </Label>
                <Input
                  id="full_name"
                  name="full_name"
                  type="text"
                  placeholder="John Doe"
                  required
                  className="w-full bg-input border-border"
                />
              </div>

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
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  name="password"
                  placeholder="Your password"
                  minLength={6}
                  required
                  className="w-full bg-input border-border"
                />
              </div>
            </div>

            <SubmitButton
              formAction={signUpAction}
              pendingText="Creating account..."
              className="w-full glow-teal"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create Account
            </SubmitButton>

            <FormMessage message={searchParams} />
          </form>
        </UrlProvider>
      </div>
      <SmtpMessage />
    </div>
  );
}
