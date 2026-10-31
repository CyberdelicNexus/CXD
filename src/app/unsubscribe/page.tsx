import { UnsubscribeButton } from '@/components/unsubscribe-button';
import { verifyUnsubscribeToken } from '@/lib/email-unsubscribe';

export const metadata = { title: 'Unsubscribe', robots: { index: false, follow: false } };

// Opening the link changes nothing, because mail scanners open links.
export default function UnsubscribePage({ searchParams }: { searchParams: { token?: string | string[] } }) {
  const raw = searchParams.token;
  const token = typeof raw === 'string' ? raw : '';
  const valid = verifyUnsubscribeToken(token, process.env.EMAIL_UNSUBSCRIBE_SECRET ?? '') !== null;

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Email preferences</h1>
        {valid ? (
          <UnsubscribeButton token={token} />
        ) : (
          <p className="text-white/60">This link is not valid. Email contact@cyberdelic.design and we will unsubscribe you.</p>
        )}
      </div>
    </main>
  );
}
