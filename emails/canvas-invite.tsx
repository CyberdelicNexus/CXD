import { Section, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';
import { EmailCard } from './_components/email-card';

interface CanvasInviteEmailProps {
  inviterName: string;
  canvasName: string;
  inviteUrl: string;
}

export default function CanvasInviteEmail({
  inviterName,
  canvasName,
  inviteUrl,
}: CanvasInviteEmailProps) {
  return (
    <EmailLayout previewText={`${inviterName} invited you to collaborate on "${canvasName}"`}>
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
          You're Invited!
        </Heading>
      </Section>

      {/* Content */}
      <Section style={{ padding: '20px 40px' }}>
        <Text
          style={{
            color: '#a0a0b0',
            fontSize: '16px',
            lineHeight: '1.6',
            margin: '0 0 20px',
          }}
        >
          <strong style={{ color: '#edfcfc' }}>{inviterName}</strong> has invited you
          to collaborate on their canvas:
        </Text>

        <EmailCard>
          <Text
            style={{
              color: '#22c9b8',
              fontSize: '22px',
              fontWeight: 600,
              margin: 0,
            }}
          >
            {canvasName}
          </Text>
        </EmailCard>

        <Text
          style={{
            color: '#a0a0b0',
            fontSize: '14px',
            lineHeight: '1.6',
            margin: '0 0 30px',
          }}
        >
          As a collaborator, you'll be able to view and edit this canvas in
          real-time with the team.
        </Text>
      </Section>

      {/* CTA */}
      <Section style={{ padding: '0 40px 40px', textAlign: 'center' as const }}>
        <EmailButton href={inviteUrl}>Accept Invitation</EmailButton>
      </Section>

      {/* Expiry Note */}
      <Section
        style={{
          padding: '20px 40px 30px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Text
          style={{
            color: '#6b6b7b',
            fontSize: '12px',
            textAlign: 'center' as const,
            margin: 0,
          }}
        >
          This invitation expires in 7 days. If you didn't expect this
          invitation, you can safely ignore this email.
        </Text>
      </Section>
    </EmailLayout>
  );
}

CanvasInviteEmail.PreviewProps = {
  inviterName: 'Sarah Chen',
  canvasName: 'Q4 Experience Strategy',
  inviteUrl: 'https://canvas.cyberdelic.design/invite?token=abc123',
} satisfies CanvasInviteEmailProps;
