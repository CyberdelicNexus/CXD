import { Section } from '@react-email/components';
import * as React from 'react';

interface EmailCardProps {
  children: React.ReactNode;
}

export function EmailCard({ children }: EmailCardProps) {
  return (
    <Section
      style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid rgba(255,255,255,0.1)',
        marginBottom: '24px',
      }}
    >
      {children}
    </Section>
  );
}
