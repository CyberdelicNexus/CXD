import { Button } from '@react-email/components';
import * as React from 'react';

interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
}

export function EmailButton({ href, children }: EmailButtonProps) {
  return (
    <Button
      href={href}
      style={{
        background: 'linear-gradient(135deg, #a78bfa 0%, #6334c7 100%)',
        color: '#ffffff',
        padding: '16px 40px',
        borderRadius: '9999px',
        fontWeight: 600,
        fontSize: '16px',
        textDecoration: 'none',
        display: 'inline-block',
        boxShadow: '0 0 30px rgba(139,92,246,0.4)',
        boxSizing: 'border-box' as const,
      }}
    >
      {children}
    </Button>
  );
}
