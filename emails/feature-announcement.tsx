import { Section, Heading, Text, Img } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';

interface FeatureAnnouncementProps {
  userName: string;
  featureTitle: string;
  featureDescription: string;
  featureImageUrl?: string;
  ctaText: string;
  ctaUrl: string;
  unsubscribeUrl: string;
}

export default function FeatureAnnouncement({
  userName,
  featureTitle,
  featureDescription,
  featureImageUrl,
  ctaText,
  ctaUrl,
  unsubscribeUrl,
}: FeatureAnnouncementProps) {
  return (
    <EmailLayout
      previewText={`New in CXD Canvas: ${featureTitle}`}
      showUnsubscribe={true}
      unsubscribeUrl={unsubscribeUrl}
    >
      {/* NEW Badge + Heading */}
      <Section style={{ padding: '40px 40px 20px', textAlign: 'center' as const }}>
        <table width="100%" cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td align="center" style={{ paddingBottom: '16px' }}>
                <span
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7457ff 100%)',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1.5px',
                    padding: '6px 16px',
                    borderRadius: '9999px',
                    display: 'inline-block',
                  }}
                >
                  NEW
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
          {featureTitle}
        </Heading>
      </Section>

      {/* Hero Image */}
      {featureImageUrl && (
        <Section style={{ padding: '0 40px 20px' }}>
          <Img
            src={featureImageUrl}
            alt={featureTitle}
            width="100%"
            style={{
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'block',
            }}
          />
        </Section>
      )}

      {/* Content */}
      <Section style={{ padding: '0 40px' }}>
        <Text
          style={{
            color: '#a0a0b0',
            fontSize: '14px',
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
            lineHeight: '1.7',
            margin: '0 0 30px',
          }}
        >
          {featureDescription}
        </Text>
      </Section>

      {/* CTA */}
      <Section style={{ padding: '0 40px 40px', textAlign: 'center' as const }}>
        <EmailButton href={ctaUrl}>{ctaText}</EmailButton>
      </Section>
    </EmailLayout>
  );
}

FeatureAnnouncement.PreviewProps = {
  userName: 'Alex',
  featureTitle: 'AI-Powered Experience Flows',
  featureDescription:
    'Design complete user journeys with our new AI assistant. Simply describe your experience and watch it come to life on the canvas. Connect touchpoints, map emotions, and visualize the entire user journey — all with intelligent suggestions that adapt to your design.',
  featureImageUrl: 'https://canvas.cyberdelic.design/images/canvas-screenshot.png',
  ctaText: 'Try It Now',
  ctaUrl: 'https://canvas.cyberdelic.design/cxd',
  unsubscribeUrl: 'https://canvas.cyberdelic.design/unsubscribe?token=abc123',
} satisfies FeatureAnnouncementProps;
