import { Section, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';

interface PaymentFinalWarningProps {
  userName: string;
  amountDue: string; // e.g. "$20.00"
  accessEndsDate: string; // e.g. "April 30, 2026"
  updatePaymentUrl: string;
}

export default function PaymentFinalWarning({
  userName,
  amountDue,
  accessEndsDate,
  updatePaymentUrl,
}: PaymentFinalWarningProps) {
  return (
    <EmailLayout previewText={`Last chance to restore your Pro access before ${accessEndsDate}.`}>
      <Section style={{ padding: '40px 40px 20px' }}>
        <Heading
          as="h1"
          style={{ color: '#ffffff', fontSize: '26px', fontWeight: 700, margin: '0 0 12px', lineHeight: 1.2 }}
        >
          Last chance to restore your Pro access
        </Heading>

        <Text style={{ color: '#c8c4dd', fontSize: '15px', margin: '0 0 24px', lineHeight: 1.6 }}>
          Hi {userName}, we have tried to charge {amountDue} several times over the past five days
          and every attempt has declined. If we cannot process the payment by{' '}
          <strong style={{ color: '#ffffff' }}>{accessEndsDate}</strong>, your account will drop to
          the Free tier.
        </Text>

        <Section
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.35)',
            borderRadius: '12px',
            padding: '16px',
            margin: '0 0 16px',
          }}
        >
          <Text style={{ color: '#fda4af', fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>
            What happens if you do nothing
          </Text>
          <Text style={{ color: '#fecdd3', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
            You keep all your canvases, but lose unlimited projects, premium AI models, and team
            collaboration. Your work stays safe.
          </Text>
        </Section>

        <Section style={{ textAlign: 'center' as const, margin: '32px 0 8px' }}>
          <EmailButton href={updatePaymentUrl}>Update payment method</EmailButton>
        </Section>

        <Text style={{ color: '#6b6b7b', fontSize: '12px', margin: '20px 0 0', textAlign: 'center' as const }}>
          Questions? Just reply to this email and we will help.
        </Text>
      </Section>
    </EmailLayout>
  );
}
