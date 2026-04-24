import { Section, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';
import { EmailCard } from './_components/email-card';

interface TrialEndingSoonProps {
  userName: string;
  trialEndDate: string; // e.g. "May 8, 2026"
  cardBrand?: string;
  cardLast4?: string;
  manageBillingUrl: string;
}

export default function TrialEndingSoon({
  userName,
  trialEndDate,
  cardBrand,
  cardLast4,
  manageBillingUrl,
}: TrialEndingSoonProps) {
  const hasCard = Boolean(cardBrand && cardLast4);
  return (
    <EmailLayout previewText={`Your Pro trial ends ${trialEndDate}.`}>
      <Section style={{ padding: '40px 40px 20px' }}>
        <Heading
          as="h1"
          style={{ color: '#ffffff', fontSize: '26px', fontWeight: 700, margin: '0 0 12px', lineHeight: 1.2 }}
        >
          Your Pro trial ends on {trialEndDate}
        </Heading>

        <Text style={{ color: '#c8c4dd', fontSize: '15px', margin: '0 0 24px', lineHeight: 1.6 }}>
          Hi {userName}, your 14-day trial wraps up in a few days. On {trialEndDate} we will
          automatically start your first monthly billing cycle. You will keep full Pro access and
          your next 500 AI credits will be added to your balance.
        </Text>

        <EmailCard>
          <Text style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>
            Payment method on file
          </Text>
          <Text style={{ color: '#9a94b8', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
            {hasCard
              ? `${cardBrand?.toUpperCase()} ending in ${cardLast4}`
              : 'No card on file yet. Add one before the trial ends or your account drops to Free.'}
          </Text>
        </EmailCard>

        <Section style={{ textAlign: 'center' as const, margin: '32px 0 8px' }}>
          <EmailButton href={manageBillingUrl}>Manage billing</EmailButton>
        </Section>

        <Text style={{ color: '#6b6b7b', fontSize: '12px', margin: '20px 0 0', textAlign: 'center' as const }}>
          Want to cancel? You can end your subscription before {trialEndDate} from the same page with no charge.
        </Text>
      </Section>
    </EmailLayout>
  );
}
