import { Section, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';
import { EmailCard } from './_components/email-card';

interface PaymentFailedProps {
  userName: string;
  amountDue: string; // e.g. "$20.00"
  cardBrand?: string;
  cardLast4?: string;
  nextRetryDate?: string; // e.g. "April 26, 2026"
  updatePaymentUrl: string;
}

export default function PaymentFailed({
  userName,
  amountDue,
  cardBrand,
  cardLast4,
  nextRetryDate,
  updatePaymentUrl,
}: PaymentFailedProps) {
  return (
    <EmailLayout previewText="We could not charge your card. Please update your payment method.">
      <Section style={{ padding: '40px 40px 20px' }}>
        <Heading
          as="h1"
          style={{ color: '#ffffff', fontSize: '26px', fontWeight: 700, margin: '0 0 12px', lineHeight: 1.2 }}
        >
          We could not charge your card
        </Heading>

        <Text style={{ color: '#c8c4dd', fontSize: '15px', margin: '0 0 24px', lineHeight: 1.6 }}>
          Hi {userName}, we tried to charge {amountDue} for your CXD Canvas Pro subscription and it
          did not go through. Cards expire, banks decline, and these things happen. Updating your
          payment method takes less than a minute.
        </Text>

        <EmailCard>
          <Text style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>
            Card on file
          </Text>
          <Text style={{ color: '#9a94b8', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
            {cardBrand && cardLast4
              ? `${cardBrand.toUpperCase()} ending in ${cardLast4}.`
              : 'No card details available.'}
            {nextRetryDate && ` We will retry automatically on ${nextRetryDate}.`}
          </Text>
        </EmailCard>

        <Section style={{ textAlign: 'center' as const, margin: '32px 0 8px' }}>
          <EmailButton href={updatePaymentUrl}>Update payment method</EmailButton>
        </Section>

        <Text style={{ color: '#6b6b7b', fontSize: '12px', margin: '20px 0 0', textAlign: 'center' as const }}>
          Your Pro access is still active while we sort this out. No immediate action required if the retry succeeds.
        </Text>
      </Section>
    </EmailLayout>
  );
}
