import { Button } from '@/components/ui/button';

export const metadata = { title: 'Reset password', robots: { index: false, follow: false } };

export default function RecoveryPage({ searchParams }: { searchParams: { token_hash?: string } }) {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <form action="/auth/recovery/confirm" method="POST" className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Reset your password</h1>
        <input type="hidden" name="token_hash" value={searchParams.token_hash ?? ''} />
        <Button type="submit">Continue</Button>
      </form>
    </main>
  );
}
