import { Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';

interface SupportReplyProps {
  userName: string;
  ticketTitle: string;
  body: string;
}

export default function SupportReply({ userName, ticketTitle, body }: SupportReplyProps) {
  return (
    <EmailLayout previewText={`About your request: ${ticketTitle}`} showUnsubscribe={false}>
      <Section style={{ padding: '32px 40px' }}>
        <Text style={{ color: '#a0a0b0', fontSize: '14px', margin: '0 0 16px' }}>Hi {userName},</Text>
        {body.split(/\n{2,}/).map((paragraph, index) => (
          <Text key={index} style={{ color: '#edfcfc', fontSize: '15px', lineHeight: '1.7', margin: '0 0 16px', whiteSpace: 'pre-wrap' as const }}>
            {paragraph}
          </Text>
        ))}
        <Text style={{ color: '#6b6b7b', fontSize: '12px', margin: '16px 0 0' }}>
          About your request: {ticketTitle}
        </Text>
      </Section>
    </EmailLayout>
  );
}

SupportReply.PreviewProps = {
  userName: 'Alex',
  ticketTitle: 'The canvas froze on export',
  body: 'Thanks for reporting this.\n\nWe found the cause and fixed it.',
} satisfies SupportReplyProps;
