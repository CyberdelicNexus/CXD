import { Section, Heading, Text, Hr } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailCard } from './_components/email-card';

interface BugReportNotificationProps {
  reporterName: string;
  reporterEmail: string;
  reporterPlan: string;
  bugTitle: string;
  bugDescription: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  browserInfo?: string;
  timestamp: string;
  type?: 'bug' | 'support';
  /** Sentry event id logged for this report — search it in Sentry to correlate with crashes */
  sentryEventId?: string;
}

function DetailSection({ label, value }: { label: string; value: string }) {
  return (
    <Section style={{ marginBottom: '16px' }}>
      <Text
        style={{
          color: '#8b5cf6',
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.5px',
          margin: '0 0 4px',
        }}
      >
        {label}
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
        {value}
      </Text>
    </Section>
  );
}

export default function BugReportNotification({
  reporterName,
  reporterEmail,
  reporterPlan,
  bugTitle,
  bugDescription,
  stepsToReproduce,
  expectedBehavior,
  actualBehavior,
  browserInfo,
  timestamp,
  type = 'bug',
  sentryEventId,
}: BugReportNotificationProps) {
  const formattedTime = new Date(timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const isBugReport = type === 'bug';
  const label = isBugReport ? 'Bug Report' : 'Support Request';
  const color = isBugReport ? '#f87171' : '#8b5cf6';

  return (
    <EmailLayout previewText={`${label}: ${bugTitle}`} showUnsubscribe={false}>
      {/* Header */}
      <Section style={{ padding: '40px 40px 20px' }}>
        <Text
          style={{
            color,
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
            margin: '0 0 8px',
          }}
        >
          {label}
        </Text>
        <Heading
          style={{
            color: '#edfcfc',
            fontSize: '24px',
            fontWeight: 600,
            margin: 0,
          }}
        >
          {bugTitle}
        </Heading>
      </Section>

      {/* Reporter Info */}
      <Section style={{ padding: '0 40px' }}>
        <Section
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(109,40,217,0.15) 100%)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(139,92,246,0.3)',
            marginBottom: '24px',
          }}
        >
          <table width="100%" cellPadding={0} cellSpacing={0}>
            <tbody>
              <tr>
                <td style={{ color: '#6b6b7b', fontSize: '13px', padding: '4px 0' }}>Reporter</td>
                <td style={{ color: '#edfcfc', fontSize: '13px', padding: '4px 0', textAlign: 'right' as const }}>
                  {reporterName}
                </td>
              </tr>
              <tr>
                <td style={{ color: '#6b6b7b', fontSize: '13px', padding: '4px 0' }}>Email</td>
                <td style={{ color: '#edfcfc', fontSize: '13px', padding: '4px 0', textAlign: 'right' as const }}>
                  {reporterEmail}
                </td>
              </tr>
              <tr>
                <td style={{ color: '#6b6b7b', fontSize: '13px', padding: '4px 0' }}>Plan</td>
                <td style={{ color: '#22c9b8', fontSize: '13px', padding: '4px 0', textAlign: 'right' as const, fontWeight: 500 }}>
                  {reporterPlan}
                </td>
              </tr>
              <tr>
                <td style={{ color: '#6b6b7b', fontSize: '13px', padding: '4px 0' }}>Time</td>
                <td style={{ color: '#edfcfc', fontSize: '13px', padding: '4px 0', textAlign: 'right' as const }}>
                  {formattedTime}
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
      </Section>

      {/* Bug Details */}
      <Section style={{ padding: '0 40px 20px' }}>
        <DetailSection label="Description" value={bugDescription} />

        {stepsToReproduce && (
          <DetailSection label="Steps to Reproduce" value={stepsToReproduce} />
        )}

        {expectedBehavior && (
          <DetailSection label="Expected Behavior" value={expectedBehavior} />
        )}

        {actualBehavior && (
          <DetailSection label="Actual Behavior" value={actualBehavior} />
        )}

        {browserInfo && (
          <DetailSection label="Browser / Environment" value={browserInfo} />
        )}
        {sentryEventId && (
          <DetailSection label="Sentry Event ID" value={sentryEventId} />
        )}
      </Section>
    </EmailLayout>
  );
}

BugReportNotification.PreviewProps = {
  reporterName: 'John Doe',
  reporterEmail: 'john@example.com',
  reporterPlan: 'Pro',
  bugTitle: 'Canvas elements overlap when zooming',
  bugDescription:
    'When zooming to 150%, canvas elements overlap incorrectly. The freeform cards shift positions and stack on top of each other.',
  stepsToReproduce:
    '1. Open any canvas\n2. Add 3+ freeform cards\n3. Zoom to 150% using Ctrl+scroll\n4. Observe element overlap',
  expectedBehavior: 'Elements maintain their relative positions at all zoom levels',
  actualBehavior: 'Elements overlap and shift when zoom exceeds 125%',
  browserInfo: 'Chrome 120 / macOS 14.2',
  timestamp: new Date().toISOString(),
} satisfies BugReportNotificationProps;
