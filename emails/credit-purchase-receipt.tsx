import { Section, Heading, Text, Hr } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';
import { EmailCard } from './_components/email-card';

interface CreditPurchaseReceiptProps {
  userName: string;
  packName: string;
  creditsAmount: number;
  priceFormatted: string;
  newBalance: number;
  purchaseDate: string;
  dashboardUrl: string;
}

export default function CreditPurchaseReceipt({
  userName,
  packName,
  creditsAmount,
  priceFormatted,
  newBalance,
  purchaseDate,
  dashboardUrl,
}: CreditPurchaseReceiptProps) {
  return (
    <EmailLayout previewText={`Receipt: ${creditsAmount} AI credits added to your account`}>
      {/* Header */}
      <Section style={{ padding: '40px 40px 20px', textAlign: 'center' as const }}>
        <Text
          style={{
            color: '#22c9b8',
            fontSize: '13px',
            fontWeight: 600,
            margin: '0 0 8px',
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
          }}
        >
          Credits Added
        </Text>
        <Heading
          style={{
            color: '#edfcfc',
            fontSize: '36px',
            fontWeight: 700,
            margin: 0,
          }}
        >
          +{creditsAmount}
        </Heading>
        <Text
          style={{
            color: '#a0a0b0',
            fontSize: '14px',
            margin: '4px 0 0',
          }}
        >
          AI Credits
        </Text>
      </Section>

      {/* Receipt */}
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
          Hi {userName}, here's your receipt.
        </Text>

        <EmailCard>
          <table width="100%" cellPadding={0} cellSpacing={0}>
            <tbody>
              <tr>
                <td style={{ color: '#6b6b7b', fontSize: '14px', padding: '8px 0' }}>Pack</td>
                <td style={{ color: '#edfcfc', fontSize: '14px', padding: '8px 0', textAlign: 'right' as const }}>
                  {packName}
                </td>
              </tr>
              <tr>
                <td style={{ color: '#6b6b7b', fontSize: '14px', padding: '8px 0' }}>Credits</td>
                <td style={{ color: '#edfcfc', fontSize: '14px', padding: '8px 0', textAlign: 'right' as const }}>
                  {creditsAmount}
                </td>
              </tr>
              <tr>
                <td style={{ color: '#6b6b7b', fontSize: '14px', padding: '8px 0' }}>Date</td>
                <td style={{ color: '#edfcfc', fontSize: '14px', padding: '8px 0', textAlign: 'right' as const }}>
                  {purchaseDate}
                </td>
              </tr>
            </tbody>
          </table>

          <Hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '12px 0' }} />

          <table width="100%" cellPadding={0} cellSpacing={0}>
            <tbody>
              <tr>
                <td style={{ color: '#edfcfc', fontSize: '16px', padding: '8px 0', fontWeight: 600 }}>
                  Amount Paid
                </td>
                <td style={{ color: '#edfcfc', fontSize: '16px', padding: '8px 0', textAlign: 'right' as const, fontWeight: 600 }}>
                  {priceFormatted}
                </td>
              </tr>
              <tr>
                <td style={{ color: '#22c9b8', fontSize: '14px', padding: '8px 0', fontWeight: 500 }}>
                  New Balance
                </td>
                <td style={{ color: '#22c9b8', fontSize: '14px', padding: '8px 0', textAlign: 'right' as const, fontWeight: 500 }}>
                  {newBalance} credits
                </td>
              </tr>
            </tbody>
          </table>
        </EmailCard>
      </Section>

      {/* CTA */}
      <Section style={{ padding: '8px 40px 20px', textAlign: 'center' as const }}>
        <EmailButton href={dashboardUrl}>Use Your Credits</EmailButton>
      </Section>

      {/* Note */}
      <Section style={{ padding: '0 40px 40px' }}>
        <Text
          style={{
            color: '#6b6b7b',
            fontSize: '12px',
            textAlign: 'center' as const,
            margin: 0,
          }}
        >
          Credits do not expire. Need help?{' '}
          <a href="mailto:contact@cyberdelic.design" style={{ color: '#8b5cf6', textDecoration: 'none' }}>
            Contact support
          </a>
        </Text>
      </Section>
    </EmailLayout>
  );
}

CreditPurchaseReceipt.PreviewProps = {
  userName: 'Alex',
  packName: 'Popular',
  creditsAmount: 250,
  priceFormatted: '$10.00',
  newBalance: 375,
  purchaseDate: 'February 20, 2026',
  dashboardUrl: 'https://canvas.cyberdelic.design/cxd',
} satisfies CreditPurchaseReceiptProps;
