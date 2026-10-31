import { Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';

interface PasswordResetProps {
  resetUrl: string;
}

export default function PasswordReset({ resetUrl }: PasswordResetProps) {
  return (
    <EmailLayout previewText="Reset your CXD Canvas password" showUnsubscribe={false}>
      <Section style={{ padding: '32px 40px', textAlign: 'center' as const }}>
        <Text style={{ color: '#edfcfc', fontSize: '15px', lineHeight: '1.7', margin: '0 0 24px' }}>
          Our support team sent you this link to reset your password. It works once.
        </Text>
        <EmailButton href={resetUrl}>Reset password</EmailButton>
        <Text style={{ color: '#6b6b7b', fontSize: '12px', margin: '24px 0 0' }}>
          If you did not ask for this, you can ignore this email and your password stays the same.
        </Text>
      </Section>
    </EmailLayout>
  );
}

PasswordReset.PreviewProps = {
  resetUrl: 'https://canvas.cyberdelic.design/auth/recovery#token_hash=abc123',
} satisfies PasswordResetProps;
