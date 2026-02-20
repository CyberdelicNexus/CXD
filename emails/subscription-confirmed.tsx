import { Section, Heading, Text, Hr } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';
import { EmailCard } from './_components/email-card';

interface SubscriptionConfirmedProps {
  userName: string;
  planName: string;
  planPrice: string;
  isLifetime: boolean;
  foundingMemberNumber?: number;
  trialEndDate?: string;
  dashboardUrl: string;
}

const proFeatures = [
  'Unlimited Canvases',
  'Premium AI Models (GPT-4o, Claude Sonnet, Kimi)',
  '500 AI Credits/month',
  'Plan View with Kanban',
  'Smart Templates',
  'Team collaboration (3)',
  'Priority support',
];

const lifetimeFeatures = [
  'Everything in Pro',
  'All AI Models (Including Claude Opus)',
  '1000 Credits One-Time + BYOK',
  'Bring Your Own API Keys',
  'Lifetime access — Pay once',
  'All future updates forever',
  'Founding member badge',
  'Priority feature requests',
];

export default function SubscriptionConfirmed({
  userName,
  planName,
  planPrice,
  isLifetime,
  foundingMemberNumber,
  trialEndDate,
  dashboardUrl,
}: SubscriptionConfirmedProps) {
  const features = isLifetime ? lifetimeFeatures : proFeatures;

  const heading = isLifetime && foundingMemberNumber
    ? `You're Founding Member #${foundingMemberNumber}!`
    : `Welcome to ${planName}!`;

  return (
    <EmailLayout previewText={`Your ${planName} plan is confirmed!`}>
      {/* Header */}
      <Section style={{ padding: '40px 40px 20px', textAlign: 'center' as const }}>
        {/* Confirmed Badge */}
        <table width="100%" cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td align="center" style={{ paddingBottom: '16px' }}>
                <span
                  style={{
                    background: 'rgba(34,201,184,0.15)',
                    color: '#22c9b8',
                    fontSize: '13px',
                    fontWeight: 600,
                    padding: '8px 20px',
                    borderRadius: '9999px',
                    border: '1px solid rgba(34,201,184,0.3)',
                    display: 'inline-block',
                  }}
                >
                  Confirmed
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <Heading
          style={{
            color: '#edfcfc',
            fontSize: '28px',
            fontWeight: 600,
            margin: 0,
          }}
        >
          {heading}
        </Heading>
      </Section>

      {/* Plan Details */}
      <Section style={{ padding: '0 40px' }}>
        <Text
          style={{
            color: '#a0a0b0',
            fontSize: '16px',
            lineHeight: '1.6',
            margin: '0 0 20px',
            textAlign: 'center' as const,
          }}
        >
          Hi {userName}, your {planName} plan is now active.
        </Text>

        <EmailCard>
          <table width="100%" cellPadding={0} cellSpacing={0}>
            <tbody>
              <tr>
                <td style={{ color: '#6b6b7b', fontSize: '14px', padding: '6px 0' }}>Plan</td>
                <td style={{ color: '#edfcfc', fontSize: '14px', padding: '6px 0', textAlign: 'right' as const, fontWeight: 600 }}>
                  {planName}
                </td>
              </tr>
              <tr>
                <td style={{ color: '#6b6b7b', fontSize: '14px', padding: '6px 0' }}>Price</td>
                <td style={{ color: '#edfcfc', fontSize: '14px', padding: '6px 0', textAlign: 'right' as const }}>
                  {planPrice}
                </td>
              </tr>
              {isLifetime && foundingMemberNumber && (
                <tr>
                  <td style={{ color: '#6b6b7b', fontSize: '14px', padding: '6px 0' }}>Founding #</td>
                  <td style={{ color: '#a78bfa', fontSize: '14px', padding: '6px 0', textAlign: 'right' as const, fontWeight: 600 }}>
                    #{foundingMemberNumber} of 250
                  </td>
                </tr>
              )}
              {trialEndDate && (
                <tr>
                  <td style={{ color: '#6b6b7b', fontSize: '14px', padding: '6px 0' }}>Trial ends</td>
                  <td style={{ color: '#f59e0b', fontSize: '14px', padding: '6px 0', textAlign: 'right' as const }}>
                    {new Date(trialEndDate).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </EmailCard>
      </Section>

      {/* Features */}
      <Section style={{ padding: '0 40px' }}>
        <Text
          style={{
            color: '#8b5cf6',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
            margin: '0 0 12px',
          }}
        >
          What's included
        </Text>
        {features.map((feature) => (
          <Text
            key={feature}
            style={{
              color: '#a0a0b0',
              fontSize: '14px',
              margin: '0 0 8px',
              lineHeight: '1.4',
              paddingLeft: '16px',
            }}
          >
            &#8226; {feature}
          </Text>
        ))}
      </Section>

      {/* CTA */}
      <Section style={{ padding: '28px 40px 40px', textAlign: 'center' as const }}>
        <EmailButton href={dashboardUrl}>Start Designing</EmailButton>
      </Section>
    </EmailLayout>
  );
}

SubscriptionConfirmed.PreviewProps = {
  userName: 'Alex',
  planName: 'Founding Member',
  planPrice: '$399 one-time',
  isLifetime: true,
  foundingMemberNumber: 42,
  dashboardUrl: 'https://canvas.cyberdelic.design/dashboard',
} satisfies SubscriptionConfirmedProps;
