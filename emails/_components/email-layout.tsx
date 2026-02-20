import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Img,
  Text,
  Link,
  Hr,
} from '@react-email/components';
import * as React from 'react';

const LOGO_URL = 'https://canvas.cyberdelic.design/images/CL%20Logo%20NL.png';
const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

interface EmailLayoutProps {
  previewText: string;
  children: React.ReactNode;
  showUnsubscribe?: boolean;
  unsubscribeUrl?: string;
}

export function EmailLayout({
  previewText,
  children,
  showUnsubscribe = true,
  unsubscribeUrl,
}: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          backgroundColor: '#000000',
          backgroundImage: 'radial-gradient(circle, rgba(139,92,246,0.15) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          margin: 0,
          padding: 0,
          fontFamily: FONT_FAMILY,
        }}
      >
        <Container
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '40px 20px',
          }}
        >
          {/* Header */}
          <Section style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
            <Img
              src={LOGO_URL}
              alt="CXD Canvas"
              width="48"
              height="48"
              style={{ margin: '0 auto 12px', display: 'block' }}
            />
            <Text
              style={{
                color: '#edfcfc',
                fontSize: '18px',
                fontWeight: 600,
                fontFamily: FONT_FAMILY,
                margin: 0,
                letterSpacing: '0.5px',
              }}
            >
              CXD Canvas
            </Text>
          </Section>

          {/* Content Card */}
          <Section
            style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}
          >
            {children}
          </Section>

          {/* Footer */}
          <Section style={{ textAlign: 'center' as const, marginTop: '32px' }}>
            <Text
              style={{
                color: '#6b6b7b',
                fontSize: '12px',
                fontFamily: FONT_FAMILY,
                margin: '0 0 8px',
              }}
            >
              &copy; {new Date().getFullYear()} Cyberdelic Labs. All rights reserved.
            </Text>
            {showUnsubscribe && unsubscribeUrl && (
              <Link
                href={unsubscribeUrl}
                style={{
                  color: '#6b6b7b',
                  fontSize: '12px',
                  fontFamily: FONT_FAMILY,
                  textDecoration: 'underline',
                }}
              >
                Unsubscribe
              </Link>
            )}
            <Text
              style={{
                color: '#4b4b5b',
                fontSize: '11px',
                fontFamily: FONT_FAMILY,
                margin: '12px 0 0',
              }}
            >
              Sent from{' '}
              <Link
                href="https://canvas.cyberdelic.design"
                style={{ color: '#8b5cf6', textDecoration: 'none' }}
              >
                CXD Canvas
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
