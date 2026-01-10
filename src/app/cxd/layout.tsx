import { Toaster } from '@/components/ui/toaster';

export default function CXDLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {children}
      <Toaster />
    </div>
  );
}
