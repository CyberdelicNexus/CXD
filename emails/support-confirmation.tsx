import { Section, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';

interface SupportConfirmationProps {
  userName: string;
  type: 'bug' | 'support';
  title: string;
  description: string;
}

export default function SupportConfirmation({
  userName,
  type,
  title,
  description,
}: SupportConfirmationProps) {
  const isBugReport = type === 'bug';
  const label = isBugReport ? 'Bug Report' : 'Support Request';

  return (
    <EmailLayout previewText={`We received your ${label.toLowerCase()}`} showUnsubscribe={false}>
      {/* Header */}
      <Section style={{ padding: '40px 40px 20px', textAlign: 'center' as const }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 16px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(109,40,217,0.2) 100%)',
            border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: '32px',
              margin: 0,
            }}
          >
            ✓
          </Text>
        </div>
        <Heading
          style={{
            color: '#edfcfc',
            fontSize: '24px',
            fontWeight: 600,
            margin: 0,
          }}
        >
          We Got Your Message
        </Heading>
      </Section>

      {/* Content */}
      <Section style={{ padding: '0 40px' }}>
        <Text
          style={{
            color: '#a0a0b0',
            fontSize: '16px',
            lineHeight: '1.6',
            margin: '0 0 24px',
            textAlign: 'center' as const,
          }}
        >
          Hi {userName}, thank you for reaching out. We've received your {label.toLowerCase()} and will get back to you as soon as possible.
        </Text>

        {/* What you sent */}
        <Section
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(109,40,217,0.15) 100%)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(139,92,246,0.3)',
            marginBottom: '24px',
          }}
        >
          <Text
            style={{
              color: '#8b5cf6',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.5px',
              margin: '0 0 8px',
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              color: '#a0a0b0',
              fontSize: '14px',
              lineHeight: '1.6',
              margin: 0,
              whiteSpace: 'pre-wrap' as const,
            }}
          >
            {description}
          </Text>
        </Section>

        <Text
          style={{
            color: '#6b6b7b',
            fontSize: '13px',
            textAlign: 'center' as const,
            margin: '0 0 30px',
          }}
        >
          We typically respond within 24 hours on business days.
        </Text>
      </Section>
    </EmailLayout>
  );
}

SupportConfirmation.PreviewProps = {
  userName: 'Alex',
  type: 'support',
  title: 'Support Request',
  description: 'I need help understanding how to use the Plan view feature.',
} satisfies SupportConfirmationProps;
