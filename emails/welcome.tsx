import { Section, Heading, Text, Hr } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';

interface WelcomeEmailProps {
  userName: string;
  dashboardUrl: string;
}

const features = [
  {
    label: 'Infinite Canvas',
    description: 'Design experiences on a boundless workspace with freeform cards, text, images, and connections.',
    color: '#8b5cf6',
  },
  {
    label: 'AI-Powered Design',
    description: 'Generate content, analyze flows, and get intelligent suggestions powered by premium AI models.',
    color: '#22c9b8',
  },
  {
    label: 'Real-time Collaboration',
    description: 'Invite your team to co-create on the same canvas with live updates and shared views.',
    color: '#a78bfa',
  },
];

export default function WelcomeEmail({ userName, dashboardUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout previewText="Welcome to CXD Canvas — your experience design studio">
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
          Welcome to CXD Canvas
        </Heading>
      </Section>

      {/* Greeting */}
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
          Thanks for joining! CXD Canvas is your space to design, prototype, and
          map out experiences — powered by AI and built for creative minds.
        </Text>
      </Section>

      {/* Features */}
      <Section style={{ padding: '0 40px' }}>
        {features.map((feature) => (
          <Section
            key={feature.label}
            style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '12px',
              padding: '16px 20px',
              border: '1px solid rgba(255,255,255,0.1)',
              marginBottom: '12px',
            }}
          >
            <Text
              style={{
                color: feature.color,
                fontSize: '14px',
                fontWeight: 600,
                margin: '0 0 4px',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.5px',
              }}
            >
              {feature.label}
            </Text>
            <Text
              style={{
                color: '#a0a0b0',
                fontSize: '14px',
                lineHeight: '1.5',
                margin: 0,
              }}
            >
              {feature.description}
            </Text>
          </Section>
        ))}
      </Section>

      {/* Credits Note */}
      <Section style={{ padding: '16px 40px 0' }}>
        <Text
          style={{
            color: '#22c9b8',
            fontSize: '14px',
            textAlign: 'center' as const,
            margin: 0,
            fontWeight: 500,
          }}
        >
          You have 50 free AI credits to get started
        </Text>
      </Section>

      {/* CTA */}
      <Section style={{ padding: '24px 40px 40px', textAlign: 'center' as const }}>
        <EmailButton href={dashboardUrl}>Open Your Canvas</EmailButton>
      </Section>
    </EmailLayout>
  );
}

WelcomeEmail.PreviewProps = {
  userName: 'Alex',
  dashboardUrl: 'https://canvas.cyberdelic.design/dashboard',
} satisfies WelcomeEmailProps;
