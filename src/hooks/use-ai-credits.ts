'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ModelId } from '@/lib/ai-credit-config';

export interface AICreditsData {
  userId: string;
  monthlyAllowance: number;
  usedThisPeriod: number;
  addonCredits: number;
  periodStart: string;
  periodEnd: string;
  selectedModel: string;
}

export interface AICreditsInfo {
  remaining: number;
  total: number;
  used: number;
  periodEnd: Date | null;
  selectedModel: ModelId;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  modelUsed: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  creditsConsumed: number | null;
  transactionType: 'usage' | 'addon_purchase' | 'monthly_reset' | 'manual_adjustment';
  projectId: string | null;
  faceKey: string | null;
  createdAt: string;
}

export function useAICredits() {
  const [credits, setCredits] = useState<AICreditsInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCredits = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/ai/credits');
      if (!res.ok) throw new Error('Failed to fetch credits');

      const data = await res.json();
      const creditsData: AICreditsData = data.credits;

      const total = creditsData.monthlyAllowance + creditsData.addonCredits;
      const remaining = total - creditsData.usedThisPeriod;

      setCredits({
        remaining,
        total,
        used: creditsData.usedThisPeriod,
        periodEnd: creditsData.periodEnd ? new Date(creditsData.periodEnd) : null,
        selectedModel: creditsData.selectedModel,
      });
    } catch (error) {
      console.error('Error fetching AI credits:', error);
      setCredits(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSelectedModel = useCallback(async (model: ModelId) => {
    try {
      const res = await fetch('/api/ai/credits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedModel: model }),
      });

      if (!res.ok) throw new Error('Failed to update model');

      // Refetch to get updated data
      await fetchCredits();

      // Notify all components using this hook to refetch
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ai-credits-changed'));
      }
    } catch (error) {
      console.error('Error updating selected model:', error);
    }
  }, [fetchCredits]);

  const consumeCredits = useCallback(async (
    credits: number,
    model: ModelId,
    inputTokens: number,
    outputTokens: number,
    projectId?: string,
    faceKey?: string
  ) => {
    try {
      const res = await fetch('/api/ai/credits/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credits,
          model,
          inputTokens,
          outputTokens,
          projectId,
          faceKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402) {
          // Insufficient credits
          return {
            success: false,
            error: 'insufficient_credits',
            available: data.available,
            required: data.required,
          };
        }
        throw new Error('Failed to consume credits');
      }

      // Refetch to update balance
      await fetchCredits();

      return {
        success: true,
        balance: data.balance,
        consumed: data.consumed,
      };
    } catch (error) {
      console.error('Error consuming credits:', error);
      return {
        success: false,
        error: 'consumption_failed',
      };
    }
  }, [fetchCredits]);

  const fetchLedger = useCallback(async (
    limit: number = 50,
    offset: number = 0,
    type?: 'usage' | 'addon_purchase' | 'monthly_reset' | 'manual_adjustment'
  ) => {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (type) {
        params.append('type', type);
      }

      const res = await fetch(`/api/ai/credits/ledger?${params}`);
      if (!res.ok) throw new Error('Failed to fetch ledger');

      const data = await res.json();
      return {
        transactions: data.transactions as CreditTransaction[],
        pagination: data.pagination,
      };
    } catch (error) {
      console.error('Error fetching credit ledger:', error);
      return {
        transactions: [],
        pagination: { total: 0, limit, offset, hasMore: false },
      };
    }
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const remainingCredits = credits?.remaining ?? 0;
  const totalCredits = credits?.total ?? 0;
  const isLow = remainingCredits < totalCredits * 0.2;
  const isDepleted = remainingCredits === 0;

  return {
    credits,
    isLoading,
    refetch: fetchCredits,
    // Individual properties for easier access
    remainingCredits,
    totalCredits,
    selectedModel: (credits?.selectedModel as ModelId) || 'gemini-2.0-flash',
    isLow,
    isDepleted,
    setSelectedModel: updateSelectedModel,
    // New credit system functions
    consumeCredits,
    fetchLedger,
  };
}
