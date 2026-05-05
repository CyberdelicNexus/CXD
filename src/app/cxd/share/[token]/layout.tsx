import type { Metadata } from 'next';
import { createClient } from '@/supabase/server';

type Props = {
  params: Promise<{ token: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from('cxd_projects')
    .select('name, description, cover_image')
    .eq('share_token', token)
    .single();

  const title = project?.name || 'Shared Canvas';
  const description =
    project?.description || 'View this shared experience design canvas on CXD.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      ...(project?.cover_image && {
        images: [{ url: project.cover_image, width: 1200, height: 630 }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(project?.cover_image && {
        images: [project.cover_image],
      }),
    },
  };
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
