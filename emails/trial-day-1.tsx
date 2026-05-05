import { Section, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';
import { EmailCard } from './_components/email-card';

interface TrialDay1Props {
  userName: string;
  trialEndDate: string; // e.g. "May 8, 2026"
  dashboardUrl: string;
}

const gettingStartedTips = [
  {
    title: 'Create your first canvas',
    body: 'Start with a blank canvas or pick a template. Drop in notes, tasks, images, or whole boards.',
  },
  {
    title: 'Try the Hypercube',
    body: 'Tag canvas objects to the six faces and ask Cyberdelic Intelligence what patterns it sees.',
  },
  {
    title: 'Invite a collaborator',
    body: 'Live cursors, shared comments, and follow-the-view are all built in. No meeting link required.',
  },
];

export default function TrialDay1({ userName, trialEndDate, dashboardUrl }: TrialDay1Props) {
  return (
    <EmailLayout previewText={`Your Pro trial is live. Runs through ${trialEndDate}.`}>
      <Section style={{ padding: '40px 40px 20px' }}>
        <Heading
          as="h1"
          style={{
            color: '#ffffff',
            fontSize: '28px',
            fontWeight: 700,
            margin: '0 0 12px',
            lineHeight: 1.2,
          }}
        >
          Your Pro trial is live
        </Heading>
        <Text style={{ color: '#c8c4dd', fontSize: '15px', margin: '0 0 24px', lineHeight: 1.6 }}>
          Hi {userName}, welcome to CXD Canvas Pro. Your 14-day trial runs through{' '}
          <strong style={{ color: '#ffffff' }}>{trialEndDate}</strong>. Here are three ways to get
          the most out of it.
        </Text>

        {gettingStartedTips.map((tip, i) => (
          <EmailCard key={i}>
            <Text style={{ color: '#ffffff', fontSize: '15px', fontWeight: 600, margin: '0 0 6px' }}>
              {i + 1}. {tip.title}
            </Text>
            <Text style={{ color: '#9a94b8', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
              {tip.body}
            </Text>
          </EmailCard>
        ))}

        <Section style={{ textAlign: 'center' as const, margin: '32px 0 8px' }}>
          <EmailButton href={dashboardUrl}>Open your dashboard</EmailButton>
        </Section>

        <Text
          style={{ color: '#6b6b7b', fontSize: '12px', margin: '20px 0 0', textAlign: 'center' as const }}
        >
          Questions? Just reply to this email.
        </Text>
      </Section>
    </EmailLayout>
  );
}
