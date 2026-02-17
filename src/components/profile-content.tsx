'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Mail,
  Calendar,
  CreditCard,
  ExternalLink,
  Crown,
  Sparkles,
  Shield,
  Key,
  ArrowLeft,
  Zap,
  Check,
  Camera,
  Upload,
  Pencil,
} from 'lucide-react';
import { useSubscription } from '@/hooks/use-subscription';
import { useAICredits } from '@/hooks/use-ai-credits';
import { UpgradeModal } from '@/components/upgrade-modal';
import { CreditTopUpModal } from '@/components/cxd/credit-topup-modal';
import {
  updateNameAction,
  deleteAccountAction,
  cancelSubscriptionAction
} from '@/app/actions';
import { SubmitButton } from '@/components/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getUserProfile,
  uploadProfileImage,
  updateUserProfilePicture,
  updateUserCoverImage,
  updateUserCoverImagePosition,
  UserProfile,
} from '@/lib/user-profile';
import { ShimmerGrid } from '@/components/ui/shimmer-grid';

interface ProfileContentProps {
  userId: string;
  userEmail: string;
}

export function ProfileContent({ userId, userEmail }: ProfileContentProps) {
  const router = useRouter();
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [coverImagePosition, setCoverImagePosition] = useState({ x: 0, y: 0 });
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isCancellingSub, setIsCancellingSub] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);

  const {
    subscription,
    plan,
    isPro,
    isLifetime,
    isBetaTester,
    isFree,
    isTrialing,
    isActive,
    trialDaysRemaining,
  } = useSubscription();

  const {
    remainingCredits,
    totalCredits,
    isLow: creditsLow,
    isDepleted: creditsDepleted,
    selectedModel,
    isLoading: creditsLoading,
  } = useAICredits();

  const userName = userEmail
    .split('@')[0]
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  useEffect(() => {
    const loadProfile = async () => {
      const profile = await getUserProfile(userId);
      if (profile) {
        setUserProfile(profile);
        setCoverImagePosition(profile.cover_image_position);
        setNewName(profile.full_name || profile.name || '');
      }
    };
    loadProfile();
  }, [userId]);

  const handleManageBilling = async () => {
    setIsPortalLoading(true);
    try {
      const response = await fetch('/api/stripe/create-portal', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('Portal error:', data.error);
        alert('Unable to access billing portal. Please try again.');
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert('Unable to access billing portal. Please try again.');
    } finally {
      setIsPortalLoading(false);
    }
  };

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingProfile(true);
    try {
      const imageUrl = await uploadProfileImage(userId, file, 'profile');
      if (imageUrl) {
        const success = await updateUserProfilePicture(userId, imageUrl);
        if (success) {
          setUserProfile((prev) => prev ? { ...prev, profile_picture: imageUrl } : null);
        }
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
    } finally {
      setIsUploadingProfile(false);
    }
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCover(true);
    try {
      const imageUrl = await uploadProfileImage(userId, file, 'cover');
      if (imageUrl) {
        const success = await updateUserCoverImage(userId, imageUrl);
        if (success) {
          setUserProfile((prev) => prev ? { ...prev, cover_image: imageUrl } : null);
        }
      }
    } catch (error) {
      console.error('Error uploading cover image:', error);
    } finally {
      setIsUploadingCover(false);
    }
  };

  // Get plan badge info
  const getPlanBadge = () => {
    if (isLifetime) return { label: 'Lifetime', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Crown };
    if (isBetaTester) return { label: 'Beta Tester', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30', icon: Shield };
    if (isPro) return { label: isTrialing ? `Pro Trial` : 'Pro', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30', icon: Sparkles };
    return { label: 'Free', color: 'bg-white/10 text-white/60 border-white/10', icon: User };
  };

  const planBadge = getPlanBadge();
  const PlanIcon = planBadge.icon;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Interactive Shimmer Grid Background */}
      <ShimmerGrid
        dotSize={1.5}
        dotSpacing={24}
        baseColor="rgba(110, 56, 236, 0.1)"
        hoverColor="rgba(138, 99, 255, 0.5)"
        hoverSize={400}
        smoothing={60}
      />

      {/* Background gradient overlay */}
      <div className="fixed inset-0 hero-gradient pointer-events-none" />

      {/* Decorative orbs */}
      <div className="glow-orb" style={{ top: '10%', right: '10%', opacity: 0.3 }} />
      <div className="glow-orb glow-orb-cyan" style={{ bottom: '20%', left: '5%', opacity: 0.2 }} />

      <div className="relative z-10 container mx-auto px-4 py-6 max-w-4xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard')}
          className="mb-6 text-white/60 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Profile Header */}
        <div className="glass-card-glow rounded-2xl overflow-hidden mb-6">
          {/* Cover Image */}
          <div className="relative h-32 bg-gradient-to-br from-violet-900/30 via-purple-900/20 to-cyan-900/20 overflow-hidden">
            {userProfile?.cover_image ? (
              <Image
                src={userProfile.cover_image}
                alt="Cover"
                fill
                className="object-cover"
                style={{ objectPosition: `50% ${50 + coverImagePosition.y / 4}%` }}
              />
            ) : null}
            <div className="absolute top-3 right-3">
              <input type="file" id="cover-upload" accept="image/*" className="hidden" onChange={handleCoverImageUpload} disabled={isUploadingCover} />
              <label htmlFor="cover-upload">
                <Button size="sm" className="bg-black/50 hover:bg-black/70 backdrop-blur text-white cursor-pointer" disabled={isUploadingCover} asChild>
                  <span><Upload className="w-3 h-3 mr-1" />{isUploadingCover ? '...' : 'Cover'}</span>
                </Button>
              </label>
            </div>
          </div>

          {/* Profile Info */}
          <div className="relative px-6 pb-6 bg-black/40 backdrop-blur-sm border-t border-white/10">
            <div className="flex items-end gap-4 -mt-10">
              {/* Profile Picture */}
              <div className="relative">
                {userProfile?.profile_picture ? (
                  <div className="relative w-20 h-20 rounded-full overflow-hidden border-4 border-black/80 shadow-2xl">
                    <Image src={userProfile.profile_picture} alt="Profile" fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full border-4 border-black/80 shadow-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30 flex items-center justify-center">
                    <User className="w-10 h-10 text-white/40" />
                  </div>
                )}
                <div className="absolute bottom-0 right-0">
                  <input type="file" id="profile-upload" accept="image/*" className="hidden" onChange={handleProfilePictureUpload} disabled={isUploadingProfile} />
                  <label htmlFor="profile-upload">
                    <Button size="sm" className="rounded-full w-7 h-7 p-0 bg-violet-600 hover:bg-violet-500 cursor-pointer" disabled={isUploadingProfile} asChild>
                      <span><Camera className="w-3 h-3" /></span>
                    </Button>
                  </label>
                </div>
              </div>

              <div className="flex-1 pt-12">
                <div className="flex items-center gap-3">
                  {isEditingName ? (
                    <form
                      action={async (formData) => {
                        await updateNameAction(formData);
                        setIsEditingName(false);
                      }}
                      className="flex items-center gap-2 flex-1 max-w-sm"
                    >
                      <Input
                        name="full_name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="h-8 bg-white/5 border-white/10 text-white"
                        autoFocus
                      />
                      <SubmitButton className="h-8 px-3 text-xs bg-violet-600 hover:bg-violet-500">
                        Save
                      </SubmitButton>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-white/40 hover:text-white"
                        onClick={() => setIsEditingName(false)}
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <>
                      <h1 className="text-xl font-bold text-white">
                        {userProfile?.full_name || userProfile?.name || userName}
                      </h1>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-6 h-6 p-0 text-white/20 hover:text-white/60"
                        onClick={() => setIsEditingName(true)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                  <Badge className={`text-xs ml-auto ${planBadge.color}`}>
                    <PlanIcon className="w-3 h-3 mr-1" />
                    {planBadge.label}
                  </Badge>
                </div>
                <p className="text-sm text-white/50">{userEmail}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Subscription Card */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-violet-400" />
              <h2 className="text-lg font-semibold text-white">Subscription</h2>
            </div>

            <div className="space-y-4">
              {/* Current Plan */}
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white/60">Current Plan</span>
                  <Badge className={planBadge.color}>
                    {plan.name}
                  </Badge>
                </div>
                <p className="text-xs text-white/40">{plan.description}</p>
              </div>

              {/* Trial Info */}
              {isTrialing && trialDaysRemaining !== null && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <Zap className="w-4 h-4 text-violet-400" />
                  <span className="text-sm text-violet-300">
                    {trialDaysRemaining} days left in trial
                  </span>
                </div>
              )}

              {/* Subscription Details */}
              {subscription && !isFree && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-white/60">
                    <span>Status</span>
                    <span className={isActive ? 'text-emerald-400' : 'text-amber-400'}>
                      {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                    </span>
                  </div>
                  {subscription.current_period_end && (
                    <div className="flex justify-between text-white/60">
                      <span>{subscription.cancel_at_period_end ? 'Expires' : 'Renews'}</span>
                      <span className="text-white/80">{formatDate(subscription.current_period_end)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Plan Features */}
              <div className="pt-2">
                <p className="text-xs text-white/40 mb-2">Included features:</p>
                <ul className="space-y-1">
                  {plan.features.slice(0, 4).map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-white/60">
                      <Check className="w-3 h-3 text-violet-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="pt-4 space-y-2">
                {isFree ? (
                  <Button
                    onClick={() => setShowUpgradeModal(true)}
                    className="w-full btn-primary-glow"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Upgrade to Pro
                  </Button>
                ) : (
                  <div className="space-y-2">
                    {subscription?.stripe_customer_id ? (
                      <Button
                        onClick={handleManageBilling}
                        disabled={isPortalLoading}
                        className="w-full bg-white/10 hover:bg-white/20 text-white"
                      >
                        {isPortalLoading ? (
                          'Loading...'
                        ) : (
                          <>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Manage Billing
                          </>
                        )}
                      </Button>
                    ) : null}

                    {!isFree && (
                      <form action={cancelSubscriptionAction}>
                        <SubmitButton
                          variant="ghost"
                          className="w-full text-xs text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          Cancel Subscription
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Credits Card */}
          {!isFree && !creditsLoading && (
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-violet-400" />
                <h2 className="text-lg font-semibold text-white">AI Credits</h2>
              </div>

              <div className="space-y-4">
                {/* Credit Balance */}
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-white/60">Remaining Credits</span>
                    <span className="text-sm text-white/80">
                      {remainingCredits.toLocaleString()}
                      <span className="text-white/30"> / {totalCredits.toLocaleString()}</span>
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        creditsDepleted
                          ? 'bg-red-500'
                          : creditsLow
                            ? 'bg-amber-500'
                            : totalCredits > 0 && remainingCredits / totalCredits > 0.5
                              ? 'bg-emerald-500'
                              : 'bg-violet-500'
                      }`}
                      style={{ width: `${totalCredits > 0 ? Math.max((remainingCredits / totalCredits) * 100, 1) : 0}%` }}
                    />
                  </div>

                  {creditsDepleted && (
                    <p className="text-[11px] text-red-400/80 mt-2">
                      Credits depleted. Top up to continue using AI features.
                    </p>
                  )}
                </div>

                {/* Active Model */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-sm text-white/60">Active Model</span>
                  <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">
                    {selectedModel === 'gpt' ? 'GPT' : selectedModel === 'claude' ? 'Claude' : 'Gemini'}
                  </Badge>
                </div>

                {/* Top Up Button */}
                <Button
                  onClick={() => setShowTopUp(true)}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Get More Credits
                </Button>
              </div>
            </div>
          )}

          {/* Account Card */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">Account</h2>
            </div>

            <div className="space-y-4">
              {/* Account Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <Mail className="w-4 h-4 text-white/40" />
                  <div>
                    <p className="text-xs text-white/40">Email</p>
                    <p className="text-sm text-white">{userEmail}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <Calendar className="w-4 h-4 text-white/40" />
                  <div>
                    <p className="text-xs text-white/40">Member since</p>
                    <p className="text-sm text-white">{formatDate(subscription?.created_at || null)}</p>
                  </div>
                </div>
              </div>

              {/* Security */}
              <div className="pt-4 space-y-4">
                <div>
                  <p className="text-xs text-white/40 mb-2">Security</p>
                  <Link href="/dashboard/reset-password">
                    <Button
                      variant="ghost"
                      className="w-full justify-start bg-white/5 hover:bg-white/10 text-white/80"
                    >
                      <Key className="w-4 h-4 mr-2" />
                      Change Password
                    </Button>
                  </Link>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <p className="text-xs text-white/40 mb-2">Danger Zone</p>
                  {!isDeletingAccount ? (
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-red-400/60 hover:text-red-400 hover:bg-red-400/10"
                      onClick={() => setIsDeletingAccount(true)}
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Delete Account
                    </Button>
                  ) : (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 space-y-3">
                      <p className="text-xs text-red-400 font-medium">
                        Are you absolutely sure? This will permanently delete your account, all your projects, and all your data.
                      </p>
                      <div className="flex gap-2">
                        <form action={deleteAccountAction} className="flex-1">
                          <SubmitButton
                            variant="destructive"
                            className="w-full h-8 text-xs bg-red-600 hover:bg-red-500"
                          >
                            Yes, delete forever
                          </SubmitButton>
                        </form>
                        <Button
                          variant="ghost"
                          className="flex-1 h-8 text-xs text-white/60 hover:text-white"
                          onClick={() => setIsDeletingAccount(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />

      {/* Credit Top-Up Modal */}
      <CreditTopUpModal
        isOpen={showTopUp}
        onClose={() => setShowTopUp(false)}
      />
    </main>
  );
}
