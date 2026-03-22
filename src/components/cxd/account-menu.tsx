"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Settings,
  Home,
  LogOut,
  Zap,
  Crown,
  Sparkles,
  Clock,
  CreditCard,
  LayoutTemplate,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { PlanId } from "@/hooks/use-subscription";

interface AICreditsInfo {
  remaining: number;
  total: number;
  periodEnd: Date | null;
}

interface AccountMenuProps {
  userEmail?: string;
  aiCredits?: AICreditsInfo | null;
  onLogout?: () => void;
  onOpenSettings?: () => void;
  onOpenTemplates?: () => void;
  // Subscription data passed from parent
  plan?: PlanId;
  isTrialing?: boolean;
  trialDaysRemaining?: number | null;
}

export function AccountMenu({
  userEmail,
  aiCredits,
  onLogout,
  onOpenSettings,
  onOpenTemplates,
  plan = 'free',
  isTrialing = false,
  trialDaysRemaining = null,
}: AccountMenuProps) {
  const router = useRouter();

  const isPro = plan === 'pro';
  const isLifetime = plan === 'lifetime';
  const isFree = plan === 'free';

  // Calculate tier display
  const tierInfo = isLifetime
    ? { label: "Lifetime", color: "text-amber-400", icon: Crown }
    : isPro
    ? { label: "Pro", color: "text-purple-400", icon: Sparkles }
    : isTrialing
    ? { label: "Pro Trial", color: "text-blue-400", icon: Zap }
    : { label: "Free", color: "text-gray-400", icon: User };

  const TierIcon = tierInfo.icon;

  // Calculate credits remaining
  const creditsRemaining = aiCredits
    ? aiCredits.remaining
    : 0;
  const creditsTotal = aiCredits
    ? aiCredits.total
    : 0;

  const creditsLow = creditsRemaining < creditsTotal * 0.2;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.05] backdrop-blur-md border border-white/10 hover:bg-violet-600/20 hover:border-violet-500/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] group transition-all"
        >
          <User className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
          {/* Notification dot for trial expiring soon */}
          {isTrialing && trialDaysRemaining !== null && trialDaysRemaining <= 3 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 bg-zinc-900/95 backdrop-blur-xl border-white/10 shadow-2xl"
      >
        {/* User Info */}
        <DropdownMenuLabel className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600">
              <User className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {userEmail || "User"}
              </p>
              <div className={cn("flex items-center gap-1.5 mt-1", tierInfo.color)}>
                <TierIcon className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{tierInfo.label}</span>
              </div>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-white/10" />

        {/* Trial Countdown (if trialing) */}
        {isTrialing && trialDaysRemaining !== null && (
          <>
            <div className={cn(
              "mx-2 px-3 py-2 rounded-lg",
              trialDaysRemaining <= 3 ? "bg-orange-500/10" : "bg-blue-500/10"
            )}>
              <div className="flex items-center gap-2 text-sm">
                <Clock className={cn(
                  "w-4 h-4",
                  trialDaysRemaining <= 3 ? "text-orange-400" : "text-blue-400"
                )} />
                <span className="text-white">
                  {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} left in trial
                </span>
              </div>
              <button
                onClick={() => router.push('/pricing')}
                className="mt-2 w-full px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded transition-colors"
              >
                Upgrade Now
              </button>
            </div>
            <DropdownMenuSeparator className="bg-white/10" />
          </>
        )}

        {/* AI Credits (if not lifetime with BYOK) */}
        {!isLifetime && aiCredits && (
          <>
            <div className="mx-2 px-3 py-2.5 rounded-lg bg-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/60">AI Credits</span>
                <Zap className={cn(
                  "w-4 h-4",
                  creditsLow ? "text-orange-400" : "text-green-400"
                )} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className={cn(
                  "text-2xl font-bold",
                  creditsLow ? "text-orange-400" : "text-white"
                )}>
                  {creditsRemaining}
                </span>
                <span className="text-sm text-white/40">
                  / {creditsTotal}
                </span>
              </div>
              {aiCredits.periodEnd && (
                <p className="text-xs text-white/40 mt-1">
                  Resets {new Date(aiCredits.periodEnd).toLocaleDateString()}
                </p>
              )}
              {creditsLow && (
                <button
                  onClick={() => router.push('/credits/buy')}
                  className="mt-2 w-full px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded transition-colors"
                >
                  <CreditCard className="w-3 h-3 inline mr-1" />
                  Buy More Credits
                </button>
              )}
            </div>
            <DropdownMenuSeparator className="bg-white/10" />
          </>
        )}

        {/* Lifetime Badge */}
        {isLifetime && (
          <>
            <div className="mx-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/20">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <div>
                  <p className="text-sm font-semibold text-amber-400">Lifetime Member</p>
                  <p className="text-xs text-white/60">All features unlocked forever</p>
                </div>
              </div>
            </div>
            <DropdownMenuSeparator className="bg-white/10" />
          </>
        )}

        {/* Menu Items */}
        <DropdownMenuItem
          onClick={() => router.push('/dashboard')}
          className="hover:bg-white/5 cursor-pointer text-white/80 hover:text-white px-4 py-2.5"
        >
          <Home className="w-4 h-4 mr-3" />
          Dashboard
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => router.push('/dashboard/profile')}
          className="hover:bg-white/5 cursor-pointer text-white/80 hover:text-white px-4 py-2.5"
        >
          <User className="w-4 h-4 mr-3" />
          Profile
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onOpenSettings}
          className="hover:bg-white/5 cursor-pointer text-white/80 hover:text-white px-4 py-2.5"
        >
          <Settings className="w-4 h-4 mr-3" />
          Settings
        </DropdownMenuItem>

        {onOpenTemplates && (
          <DropdownMenuItem
            onClick={onOpenTemplates}
            className="hover:bg-white/5 cursor-pointer text-white/80 hover:text-white px-4 py-2.5"
          >
            <LayoutTemplate className="w-4 h-4 mr-3" />
            Templates
          </DropdownMenuItem>
        )}

        {isFree && (
          <DropdownMenuItem
            onClick={() => router.push('/pricing')}
            className="hover:bg-purple-500/10 cursor-pointer text-purple-400 hover:text-purple-300 px-4 py-2.5"
          >
            <Sparkles className="w-4 h-4 mr-3" />
            Upgrade to Pro
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="bg-white/10" />

        <DropdownMenuItem
          onClick={onLogout}
          className="hover:bg-red-500/10 cursor-pointer text-red-400 hover:text-red-300 px-4 py-2.5"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
