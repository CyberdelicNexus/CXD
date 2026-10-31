import { RecoveryForm } from '@/components/admin/recovery-form';

export const metadata = {
  title: 'Reset password',
  robots: { index: false, follow: false },
};

export default function RecoveryPage() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <RecoveryForm />
    </main>
  );
}
