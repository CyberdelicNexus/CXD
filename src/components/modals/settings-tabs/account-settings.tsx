"use client";

import React from "react";
import { User, Mail, Crown, Calendar, ExternalLink, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/use-subscription";
import { PLANS } from "@/lib/plans";
import { useToast } from "@/hooks/use-toast";

export function AccountSettings() {
  const { plan, isTrialing, trialDaysRemaining, subscription } = useSubscription();
  const planConfig = PLANS[plan.id.toUpperCase() as keyof typeof PLANS] || PLANS.FREE;
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [profileLoading, setProfileLoading] = React.useState(true);

  // Profile fields
  const [displayName, setDisplayName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [profilePicture, setProfilePicture] = React.useState("");

  // Fetch user profile on mount
  React.useEffect(() => {
    const fetchProfile = async () => {
      try {
        setProfileLoading(true);
        const res = await fetch('/api/profile');
        if (!res.ok) throw new Error('Failed to fetch profile');

        const data = await res.json();
        setDisplayName(data.profile.name || "");
        setEmail(data.profile.email || "");
        setProfilePicture(data.profile.profile_picture || "");
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to load profile data',
          variant: 'destructive',
        });
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [toast]);

  // Update profile name
  const handleUpdateName = async () => {
    if (!displayName.trim()) return;

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: displayName.trim() }),
      });

      if (!res.ok) throw new Error('Failed to update profile');

      toast({
        title: 'Success',
        description: 'Display name updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update display name',
        variant: 'destructive',
      });
    }
  };

  const isPro = plan.id === 'pro';
  const isLifetime = plan.id === 'lifetime';
  const isFree = plan.id === 'free';

  const handleUpgrade = async (planId: 'pro' | 'lifetime') => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start checkout. Please try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/stripe/create-billing-portal', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to open billing portal. Please try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Account Settings</h3>
        <p className="text-sm text-muted-foreground">
          Manage your profile, subscription, and account preferences
        </p>
      </div>

      {/* Profile */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-purple-400" />
          <h4 className="text-sm font-semibold text-foreground">Profile</h4>
        </div>

        <div className="space-y-3 pl-6">
          {profileLoading ? (
            <div className="text-sm text-muted-foreground">Loading profile...</div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Display Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Your name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onBlur={handleUpdateName}
                    className="flex-1 px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-4 py-2 bg-background/50 border border-border rounded-lg text-foreground/70 cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">Email is managed through your account settings</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Profile Picture</label>
                <div className="flex items-center gap-3">
                  {profilePicture ? (
                    <img
                      src={profilePicture}
                      alt="Profile"
                      className="w-12 h-12 rounded-full object-cover border-2 border-border"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                      {displayName ? displayName[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  <button
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                    onClick={() => toast({ title: 'Coming Soon', description: 'Profile picture upload will be available soon' })}
                  >
                    Change Photo
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Subscription */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-purple-400" />
          <h4 className="text-sm font-semibold text-foreground">Subscription</h4>
        </div>

        <div className="pl-6">
          <div className={cn(
            "p-4 rounded-xl border",
            isLifetime
              ? "bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/30"
              : isPro
              ? "bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/30"
              : "bg-white/5 border-border"
          )}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h5 className="text-lg font-bold text-foreground">{planConfig.name}</h5>
                  {isLifetime && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-amber-500 text-black rounded">
                      LIFETIME
                    </span>
                  )}
                  {isTrialing && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-blue-500 text-white rounded">
                      TRIAL
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{planConfig.description}</p>
              </div>
              {'price' in planConfig && planConfig.price && (
                <div className="text-right">
                  <div className="text-xl font-bold text-foreground">${planConfig.price}</div>
                  <div className="text-xs text-muted-foreground">
                    {'interval' in planConfig && planConfig.interval === 'month' ? '/month' : 'one-time'}
                  </div>
                </div>
              )}
            </div>

            {isTrialing && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-3">
                <div className="flex items-center gap-2 text-sm text-blue-300">
                  <Calendar className="w-4 h-4" />
                  <strong>{trialDaysRemaining} days</strong> left in your trial
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {planConfig.features.map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                  <div className="w-1 h-1 rounded-full bg-purple-400" />
                  {feature}
                </div>
              ))}
            </div>

            {!isLifetime && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                {isFree ? (
                  <button
                    onClick={() => handleUpgrade('pro')}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Loading...' : 'Upgrade to Pro'}
                  </button>
                ) : (
                  <button
                    onClick={handleManageBilling}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 border border-border text-foreground hover:bg-white/5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Loading...' : (
                      <>
                        Manage Billing <ExternalLink className="w-3 h-3" />
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-foreground">Security</h4>

        <div className="space-y-3">
          <a
            href="/auth/reset-password"
            className="w-full px-4 py-2 border border-border text-foreground hover:bg-white/5 text-sm font-medium rounded-lg transition-colors text-left flex items-center justify-between group"
          >
            <span>Change Password</span>
            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="space-y-4 pt-4 border-t border-red-500/20">
        <h4 className="text-sm font-semibold text-red-400">Danger Zone</h4>

        <div className="space-y-3">
          <button className="w-full px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium rounded-lg transition-colors text-left flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Delete Account
          </button>
          <p className="text-xs text-muted-foreground">
            This action is permanent and cannot be undone. All your data will be deleted.
          </p>
        </div>
      </div>
    </div>
  );
}
