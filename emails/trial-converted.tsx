import { Section, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';
import { EmailCard } from './_components/email-card';

interface TrialConvertedProps {
  userName: string;
  amountCharged: string; // e.g. "$20.00"
  nextBillingDate: string; // e.g. "June 8, 2026"
  dashboardUrl: string;
  receiptUrl?: string;
}

export default function TrialConverted({
  userName,
  amountCharged,
  nextBillingDate,
  dashboardUrl,
  receiptUrl,
}: TrialConvertedProps) {
  return (
    <EmailLayout previewText="Welcome to Pro. Your first charge was successful.">
      <Section style={{ padding: '40px 40px 20px' }}>
        <Heading
          as="h1"
          style={{ color: '#ffffff', fontSize: '28px', fontWeight: 700, margin: '0 0 12px', lineHeight: 1.2 }}
        >
          Welcome to Pro
        </Heading>

        <Text style={{ color: '#c8c4dd', fontSize: '15px', margin: '0 0 24px', lineHeight: 1.6 }}>
          Hi {userName}, your trial converted and your first charge of{' '}
          <strong style={{ color: '#ffffff' }}>{amountCharged}</strong> went through. You now have
          the full Pro experience, and your 500 AI credits for this month are already in your balance.
        </Text>

        <EmailCard>
          <Text style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>
            Next billing date
          </Text>
          <Text style={{ color: '#9a94b8', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
            {nextBillingDate}. You can manage your subscription from your dashboard at any time.
          </Text>
        </EmailCard>

        <Section style={{ textAlign: 'center' as const, margin: '32px 0 8px' }}>
          <EmailButton href={dashboardUrl}>Open your dashboard</EmailButton>
        </Section>

        {receiptUrl && (
          <Text style={{ color: '#6b6b7b', fontSize: '12px', margin: '20px 0 0', textAlign: 'center' as const }}>
            Need a receipt?{' '}
            <a href={receiptUrl} style={{ color: '#8b5cf6' }}>
              View on Stripe
            </a>
          </Text>
        )}
      </Section>
    </EmailLayout>
  );
}
