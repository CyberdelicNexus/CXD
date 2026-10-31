import { Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';

interface BroadcastProps {
  userName: string;
  subject: string;
  body: string;
  /** Product updates only. Service notices have no unsubscribe. */
  unsubscribeUrl?: string;
  postalAddress?: string;
}

export default function Broadcast({ userName, subject, body, unsubscribeUrl, postalAddress }: BroadcastProps) {
  return (
    <EmailLayout
      previewText={subject}
      showUnsubscribe={!!unsubscribeUrl}
      unsubscribeUrl={unsubscribeUrl}
      postalAddress={postalAddress}
    >
      <Section style={{ padding: '32px 40px' }}>
        <Heading style={{ color: '#edfcfc', fontSize: '24px', fontWeight: 600, margin: '0 0 20px' }}>{subject}</Heading>
        <Text style={{ color: '#a0a0b0', fontSize: '14px', margin: '0 0 16px' }}>Hi {userName},</Text>
        {body.split(/\n{2,}/).map((paragraph, index) => (
          <Text key={index} style={{ color: '#edfcfc', fontSize: '15px', lineHeight: '1.7', margin: '0 0 16px', whiteSpace: 'pre-wrap' as const }}>
            {paragraph}
          </Text>
        ))}
      </Section>
    </EmailLayout>
  );
}

Broadcast.PreviewProps = {
  userName: 'Alex',
  subject: 'A better way to share your canvas',
  body: 'Sharing is now one click.\n\nOpen any canvas to try it.',
  unsubscribeUrl: 'https://canvas.cyberdelic.design/unsubscribe?token=abc123',
  postalAddress: '123 Example Street, Example City',
} satisfies BroadcastProps;
