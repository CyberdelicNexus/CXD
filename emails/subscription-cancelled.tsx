import { Section, Heading, Text, Link } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';

interface SubscriptionCancelledProps {
  userName: string;
  planName: string;
  accessEndDate?: string;
  feedbackUrl: string;
  resubscribeUrl: string;
}

const lostFeatures = [
  'Unlimited Canvases',
  'Premium AI Models',
  '500 AI Credits/month',
  'Plan View with Kanban',
  'Smart Templates',
  'Team collaboration',
];

const keptFeatures = [
  '1 Canvas',
  'Core design tools',
  'Experience flow',
  'Focus mode',
];

export default function SubscriptionCancelled({
  userName,
  planName,
  accessEndDate,
  feedbackUrl,
  resubscribeUrl,
}: SubscriptionCancelledProps) {
  return (
    <EmailLayout previewText="Your CXD Canvas subscription has been cancelled">
      {/* Header */}
      <Section style={{ padding: '40px 40px 20px', textAlign: 'center' as const }}>
        <Heading
          style={{
            color: '#edfcfc',
            fontSize: '28px',
            fontWeight: 600,
            margin: 0,
          }}
        >
          We're sorry to see you go
        </Heading>
      </Section>

      {/* Content */}
      <Section style={{ padding: '0 40px' }}>
        <Text
          style={{
            color: '#a0a0b0',
            fontSize: '16px',
            lineHeight: '1.6',
            margin: '0 0 8px',
          }}
        >
          Hi {userName},
        </Text>
        <Text
          style={{
            color: '#a0a0b0',
            fontSize: '16px',
            lineHeight: '1.6',
            margin: '0 0 24px',
          }}
        >
          Your {planName} subscription has been cancelled.
          {accessEndDate && (
            <>
              {' '}You'll continue to have full access until{' '}
              <strong style={{ color: '#edfcfc' }}>
                {new Date(accessEndDate).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </strong>
              .
            </>
          )}
        </Text>

        {/* What you lose */}
        <Section
          style={{
            background: 'rgba(248,113,113,0.05)',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid rgba(248,113,113,0.15)',
            marginBottom: '12px',
          }}
        >
          <Text
            style={{
              color: '#f87171',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.5px',
              margin: '0 0 8px',
            }}
          >
            What you'll lose
          </Text>
          {lostFeatures.map((feature) => (
            <Text
              key={feature}
              style={{
                color: '#a0a0b0',
                fontSize: '13px',
                margin: '0 0 4px',
                paddingLeft: '12px',
              }}
            >
              &#8226; {feature}
            </Text>
          ))}
        </Section>

        {/* What you keep */}
        <Section
          style={{
            background: 'rgba(34,201,184,0.05)',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid rgba(34,201,184,0.15)',
            marginBottom: '24px',
          }}
        >
          <Text
            style={{
              color: '#22c9b8',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.5px',
              margin: '0 0 8px',
            }}
          >
            What you'll keep
          </Text>
          {keptFeatures.map((feature) => (
            <Text
              key={feature}
              style={{
                color: '#a0a0b0',
                fontSize: '13px',
                margin: '0 0 4px',
                paddingLeft: '12px',
              }}
            >
              &#8226; {feature}
            </Text>
          ))}
        </Section>
      </Section>

      {/* CTA */}
      <Section style={{ padding: '0 40px 20px', textAlign: 'center' as const }}>
        <EmailButton href={feedbackUrl}>Share Feedback</EmailButton>
      </Section>

      <Section style={{ padding: '0 40px 40px', textAlign: 'center' as const }}>
        <Link
          href={resubscribeUrl}
          style={{
            color: '#8b5cf6',
            fontSize: '14px',
            textDecoration: 'underline',
          }}
        >
          Resubscribe anytime
        </Link>
      </Section>
    </EmailLayout>
  );
}

SubscriptionCancelled.PreviewProps = {
  userName: 'Alex',
  planName: 'Pro',
  accessEndDate: '2026-03-20T00:00:00Z',
  feedbackUrl: 'https://canvas.cyberdelic.design/feedback',
  resubscribeUrl: 'https://canvas.cyberdelic.design/pricing',
} satisfies SubscriptionCancelledProps;
