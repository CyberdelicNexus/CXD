'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../supabase/client'
import Image from 'next/image'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Textarea } from './ui/textarea'
import { Input } from './ui/input'
import { Label } from './ui/label'

import {
  UserCircle,
  LogOut,
  Settings,
  Shield,
  HelpCircle,
  Bell,
  FileText,
  Bug,
  MessageCircle,
  Send,
  X,
  LayoutGrid,
  PlayCircle,
  BookOpen,
  Target,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Megaphone,
  FolderOpen,
  Info,
  Check,
  UserPlus,
  Loader2,
  ClipboardList,
  Lock,
  Newspaper,
  Lightbulb,
  type LucideIcon
} from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationType, Notification } from '@/lib/notifications'
import { useSubscription } from '@/hooks/use-subscription'
import { useNexusReturnLink } from '@/hooks/use-nexus-return-link'
import { NexusReturnButton } from '@/components/nexus-return-button'
import { UpgradeModal } from '@/components/modals/upgrade-modal'

const notificationIcons: Record<NotificationType, React.ReactNode> = {
  info: <Info className="w-4 h-4 text-blue-400" />,
  success: <CheckCircle className="w-4 h-4 text-green-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  announcement: <Megaphone className="w-4 h-4 text-purple-400" />,
  update: <Sparkles className="w-4 h-4 text-cyan-400" />,
  project: <FolderOpen className="w-4 h-4 text-orange-400" />,
};

// Rail buttons are 40px circles that grow into a pill on hover/focus, sliding the label out
// to the right over the page (same motion as the canvas view switcher). The hover fill is
// near-opaque because the expanded label sits on top of the cover and tiles.
const railButtonClass = (isActive: boolean) =>
  `relative flex items-center h-10 min-w-10 px-[10px] group/rail rounded-full text-white/90 border backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-95 cursor-pointer outline-none ${
    isActive
      ? 'bg-violet-500/25 border-violet-500/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_0_20px_rgba(139,92,246,0.25)] hover:bg-zinc-950/90 hover:border-violet-400/70 hover:shadow-[0_0_0_1px_rgba(167,139,250,0.25),0_0_14px_rgba(139,92,246,0.55),inset_0_0_8px_rgba(139,92,246,0.25)]'
      : 'bg-white/[0.03] border-white/[0.08] hover:bg-zinc-950/90 hover:border-violet-400/70 hover:shadow-[0_0_0_1px_rgba(167,139,250,0.25),0_0_14px_rgba(139,92,246,0.55),inset_0_0_8px_rgba(139,92,246,0.25)] focus-visible:bg-zinc-950/90 focus-visible:border-violet-400/70'
  }`;

const railLabelClass =
  'max-w-0 opacity-0 overflow-hidden whitespace-nowrap text-xs font-medium transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/rail:max-w-[180px] group-hover/rail:opacity-100 group-hover/rail:ml-2 group-hover/rail:pr-1 group-focus-visible/rail:max-w-[180px] group-focus-visible/rail:opacity-100 group-focus-visible/rail:ml-2 group-focus-visible/rail:pr-1';

const railContent = (Icon: LucideIcon, label: string, isActive: boolean) => (
  <>
    <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${isActive ? 'text-violet-200' : 'text-white/60 group-hover/rail:text-violet-200'}`} />
    <span className={railLabelClass}>{label}</span>
  </>
);

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

/** A message the server wrote for the user (rate limit 429, validation 400): shown as is. */
class ServerMessage extends Error {}

/** Only 429 and 400 carry text meant for the user; every other failure keeps the generic alert. */
function serverMessageFor(status: number, error: unknown): ServerMessage | null {
  if (typeof error !== 'string' || !error) return null;
  if (status === 429) return new ServerMessage(`${error} If it keeps happening, email contact@cyberdelic.design`);
  if (status === 400) return new ServerMessage(error);
  return null;
}

// A floating pill menu, vertically centred on the left edge. It overlays the page; content
// containers keep clear of it below 2xl with `pl-24 2xl:pl-4`.
export default function DashboardNavbar() {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, clearAll, refresh } = useNotifications()
  const { hasMasterPlan } = useSubscription()
  const nexusReturnUrl = useNexusReturnLink()
  const [acceptingInvite, setAcceptingInvite] = useState<string | null>(null)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [supportKind, setSupportKind] = useState<'support' | 'feature'>('support')
  const [showMasterPlanUpgrade, setShowMasterPlanUpgrade] = useState(false)
  const [showBugModal, setShowBugModal] = useState(false)
  const [supportMessage, setSupportMessage] = useState('')
  const [bugDescription, setBugDescription] = useState('')
  const [bugSteps, setBugSteps] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [isStaff, setIsStaff] = useState(false)

  useEffect(() => {
    fetch('/api/me/staff-role')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setIsStaff(!!data?.role))
      .catch(() => {})
  }, [])

  const handleSupportSubmit = async () => {
    if (!supportMessage.trim()) return
    setIsSubmitting(true)

    try {
      // Get browser info
      const browserInfo = `${navigator.userAgent} | Screen: ${window.screen.width}x${window.screen.height}`

      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: supportKind,
          title: supportKind === 'feature' ? 'Feature Request' : 'Support Request',
          description: supportMessage,
          sourcePath: pathname,
          browserInfo,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSubmitSuccess(true)
        // Close dialog after brief success display
        setTimeout(() => {
          setShowSupportModal(false)
          // Closing here skips onOpenChange, so clear the draft or it reappears on the next open.
          setSupportMessage('')
        }, 1500)
      } else {
        throw serverMessageFor(response.status, data.error) ?? new Error('Failed to submit support request')
      }
    } catch (error) {
      console.error('Support submission error:', error)
      alert(error instanceof ServerMessage ? error.message : 'Failed to submit support request. Please try again or email contact@cyberdelic.design')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBugSubmit = async () => {
    if (!bugDescription.trim()) return
    setIsSubmitting(true)

    try {
      // Get browser info
      const browserInfo = `${navigator.userAgent} | Screen: ${window.screen.width}x${window.screen.height}`

      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'bug',
          sourcePath: pathname,
          title: 'Bug Report',
          description: bugDescription,
          stepsToReproduce: bugSteps || undefined,
          browserInfo,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSubmitSuccess(true)
        // Close dialog after brief success display
        setTimeout(() => {
          setShowBugModal(false)
          setBugDescription('')
          setBugSteps('')
        }, 1500)
      } else {
        throw serverMessageFor(response.status, data.error) ?? new Error('Failed to submit bug report')
      }
    } catch (error) {
      console.error('Bug report submission error:', error)
      alert(error instanceof ServerMessage ? error.message : 'Failed to submit bug report. Please try again or email contact@cyberdelic.design')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    try {
      // Flush pending Y.js binary state and JSON project_data before signing out
      const [{ flushPendingSave }, { flushYjsPersistence }] = await Promise.all([
        import('@/hooks/use-project-sync'),
        import('@/contexts/yjs-project-context'),
      ]);
      await Promise.all([flushPendingSave(), flushYjsPersistence()]);
    } catch (e) {
      console.warn('[SignOut] Failed to flush pending saves:', e);
    }
    await supabase.auth.signOut()
    router.push('/')
  }

  const isCollaborationInvite = (notification: Notification) => {
    return notification.title === 'Collaboration Invitation' && notification.metadata?.inviteToken
  }

  const handleAcceptInvite = async (e: React.MouseEvent, notification: Notification) => {
    e.preventDefault()
    e.stopPropagation()

    const token = notification.metadata?.inviteToken
    if (!token) return

    setAcceptingInvite(notification.id)
    try {
      const response = await fetch(`/api/canvas/invite/accept?token=${token}`)
      const data = await response.json()

      if (data.success) {
        await markAsRead(notification.id)
        refresh()
        router.push(`/cxd?id=${data.canvasId}`)
      } else if (data.error) {
        console.error('Error accepting invitation:', data.error)
        alert(data.error)
      }
    } catch (error) {
      console.error('Error accepting invitation:', error)
      alert('Failed to accept invitation. Please try again.')
    } finally {
      setAcceptingInvite(null)
    }
  }

  return (
    <>
      <nav
        aria-label="Dashboard"
        // Fixed width: a hovered button grows out past the bar instead of widening it
        className="fixed left-6 top-1/2 -translate-y-1/2 z-50 w-[54px] flex flex-col items-start gap-1.5 p-1.5 rounded-full border border-white/10 bg-black/50 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-visible transition-[border-color,box-shadow] duration-500 hover:border-violet-400/50 hover:shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(167,139,250,0.15),0_0_18px_rgba(139,92,246,0.35),inset_0_0_12px_rgba(139,92,246,0.12)] focus-within:border-violet-400/50"
      >
        <Link
          href="/dashboard"
          aria-label="Cyberdelic Design Canvas"
          className="group/rail flex items-center h-10 px-[6px] rounded-full transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-zinc-950/90 hover:backdrop-blur-md outline-none focus-visible:bg-zinc-950/90"
        >
          <Image
            src="/images/CXD Logo 2.png"
            alt="CXD"
            width={28}
            height={28}
            className="object-contain flex-shrink-0"
          />
          <span className={`${railLabelClass} !text-sm text-white/90`}>Cyberdelic Design Canvas</span>
        </Link>

        <div className="mx-auto my-0.5 h-px w-6 bg-white/10" />

        {[
          { id: 'dashboard', href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
          { id: 'docs', href: '/dashboard/docs', icon: BookOpen, label: 'Documentation' },
        ].map((item) => (
          <Link key={item.id} href={item.href} aria-label={item.label} className={railButtonClass(pathname === item.href)}>
            {railContent(item.icon, item.label, pathname === item.href)}
          </Link>
        ))}

        {/* Templates nav link — hidden until templates are production-ready */}

        {/* Master Plan — Pro feature, clickable for everyone but blocked
            behind an upgrade modal (not a permanent "coming soon") */}
        <button
          type="button"
          aria-label="Master Plan"
          onClick={() => {
            if (!hasMasterPlan) {
              setShowMasterPlanUpgrade(true);
              return;
            }
            router.push('/dashboard/master-plan');
          }}
          className={`${railButtonClass(pathname === '/dashboard/master-plan')} ${!hasMasterPlan ? 'opacity-70 hover:opacity-100' : ''}`}
        >
          {!hasMasterPlan && (
            <Lock className="w-3 h-3 absolute -top-1 left-7 text-orange-400 z-10" />
          )}
          {railContent(ClipboardList, 'Master Plan', pathname === '/dashboard/master-plan')}
        </button>

        <Link href="/dashboard/tutorials" aria-label="Tutorials" className={railButtonClass(pathname === '/dashboard/tutorials')}>
          {railContent(PlayCircle, 'Tutorials', pathname === '/dashboard/tutorials')}
        </Link>

        <div className="mx-auto my-0.5 h-px w-6 bg-white/10" />

        <div className="flex flex-col items-start gap-1.5">
            {/* Back to the member's dashboard on Cyberdelic Nexus (only for members who came from there) */}
            {nexusReturnUrl && <NexusReturnButton href={nexusReturnUrl} expandLabel />}

            <Link href="/changelog" aria-label="Changelog" className={railButtonClass(false)}>
              {railContent(Newspaper, 'Changelog', false)}
            </Link>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Notifications" className={railButtonClass(false)}>
                  {railContent(Bell, 'Notifications', false)}
                  {unreadCount > 0 && (
                    <span className="absolute top-2 left-[25px] w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(139,92,246,1)]" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" sideOffset={12} className="bg-zinc-900/95 backdrop-blur-xl border-white/10 w-80">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="font-semibold text-sm">Notifications</span>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-6 px-2 hover:bg-white/5"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        markAllAsRead();
                      }}
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Mark all read
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-[300px]">
                  {loading ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      Loading...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bell className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-muted-foreground text-sm">No notifications yet</p>
                      <p className="text-muted-foreground/70 text-xs mt-1">
                        You'll see updates and announcements here
                      </p>
                    </div>
                  ) : (
                    <div className="py-1">
                      {notifications.map((notification) => {
                        const isInvite = isCollaborationInvite(notification)
                        const isAccepting = acceptingInvite === notification.id

                        return (
                          <div
                            key={notification.id}
                            className={`px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors ${!notification.is_read ? 'bg-primary/5' : ''
                              }`}
                            onClick={() => !notification.is_read && !isInvite && markAsRead(notification.id)}
                          >
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5">
                                {isInvite ? (
                                  <UserPlus className="w-4 h-4 text-violet-400" />
                                ) : (
                                  notificationIcons[notification.type as NotificationType] || notificationIcons.info
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-medium ${!notification.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {notification.title}
                                  </span>
                                  {notification.is_global && (
                                    <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] rounded">
                                      Announcement
                                    </span>
                                  )}
                                </div>
                                <p className={`text-xs text-muted-foreground mt-0.5 ${notification.metadata?.broadcastId ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'}`}>
                                  {notification.message}
                                </p>
                                <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                                  {formatTimeAgo(notification.created_at)}
                                </span>

                                {/* Accept button for collaboration invitations */}
                                {isInvite && !notification.is_read && (
                                  <Button
                                    size="sm"
                                    className="mt-2 h-7 px-3 bg-violet-600 hover:bg-violet-500 text-white text-xs"
                                    onClick={(e) => handleAcceptInvite(e, notification)}
                                    disabled={isAccepting}
                                  >
                                    {isAccepting ? (
                                      <>
                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                        Accepting...
                                      </>
                                    ) : (
                                      <>
                                        <Check className="w-3 h-3 mr-1" />
                                        Accept Invitation
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                              {!notification.is_read && !isInvite && (
                                <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>
                {notifications.length > 0 && (
                  <div className="border-t border-border p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        clearAll();
                      }}
                    >
                      Clear All
                    </Button>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Help Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Help" className={railButtonClass(false)}>
                  {railContent(HelpCircle, 'Help', false)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" sideOffset={12} className="bg-zinc-900/95 backdrop-blur-xl border-white/10 w-48">
                <DropdownMenuItem
                  onClick={() => { setSupportKind('support'); setSubmitSuccess(false); setShowSupportModal(true) }}
                  className="cursor-pointer hover:bg-white/5"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Contact Support
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setSupportKind('feature'); setSubmitSuccess(false); setShowSupportModal(true) }}
                  className="cursor-pointer hover:bg-white/5"
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Request a Feature
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setSubmitSuccess(false); setShowBugModal(true) }}
                  className="cursor-pointer hover:bg-white/5"
                >
                  <Bug className="w-4 h-4 mr-2" />
                  Report a Bug
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Account" className={railButtonClass(pathname === '/dashboard/profile' || pathname === '/dashboard/settings')}>
                  {railContent(UserCircle, 'Account', pathname === '/dashboard/profile' || pathname === '/dashboard/settings')}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" sideOffset={12} className="bg-zinc-900/95 backdrop-blur-xl border-white/10 w-48">
                <DropdownMenuItem onClick={() => router.push('/dashboard/profile')} className="cursor-pointer hover:bg-white/5">
                  <UserCircle className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/dashboard/settings')} className="cursor-pointer hover:bg-white/5">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                {isStaff && (
                  <DropdownMenuItem onClick={() => router.push('/admin')} className="cursor-pointer hover:bg-white/5">
                    <Shield className="w-4 h-4 mr-2" />
                    Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive hover:bg-destructive/10">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </nav>

      {/* Support Modal */}
      <Dialog open={showSupportModal} onOpenChange={(open) => {
        setShowSupportModal(open)
        if (!open) {
          // Delay state reset to allow Radix to clean up portal
          setTimeout(() => {
            setSupportMessage('')
            setSubmitSuccess(false)
            setIsSubmitting(false)
          }, 200)
        }
      }} modal={false}>
        <DialogContent
          className="bg-zinc-900/95 backdrop-blur-xl border-white/10 text-white max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <MessageCircle className="w-5 h-5 text-violet-400" />
              {supportKind === 'feature' ? 'Request a Feature' : 'Contact Support'}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {supportKind === 'feature'
                ? 'Tell us what would make CXD Canvas more useful.'
                : "Have a question or need help? We're here to assist you."}
            </DialogDescription>
          </DialogHeader>

          {submitSuccess ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Message Sent!</h3>
              <p className="text-white/50 text-sm">We'll get back to you as soon as possible.</p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="support-message" className="text-white/70">Your Message</Label>
                <Textarea
                  id="support-message"
                  placeholder={supportKind === 'feature' ? 'Describe the feature you would like...' : 'Describe your question or issue...'}
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[120px] focus:border-violet-500/50"
                />
              </div>

              <Button
                onClick={handleSupportSubmit}
                disabled={!supportMessage.trim() || isSubmitting}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bug Report Modal */}
      <Dialog open={showBugModal} onOpenChange={(open) => {
        setShowBugModal(open)
        if (!open) {
          // Delay state reset to allow Radix to clean up portal
          setTimeout(() => {
            setBugDescription('')
            setBugSteps('')
            setSubmitSuccess(false)
            setIsSubmitting(false)
          }, 200)
        }
      }} modal={false}>
        <DialogContent
          className="bg-zinc-900/95 backdrop-blur-xl border-white/10 text-white max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Bug className="w-5 h-5 text-rose-400" />
              Report a Bug
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Found an issue? Help us improve by reporting it.
            </DialogDescription>
          </DialogHeader>

          {submitSuccess ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Bug Reported!</h3>
              <p className="text-white/50 text-sm">Thank you for helping us improve CXD Canvas.</p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="bug-description" className="text-white/70">Bug Description</Label>
                <Textarea
                  id="bug-description"
                  placeholder="What went wrong?"
                  value={bugDescription}
                  onChange={(e) => setBugDescription(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px] focus:border-rose-500/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bug-steps" className="text-white/70">Steps to Reproduce (optional)</Label>
                <Textarea
                  id="bug-steps"
                  placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                  value={bugSteps}
                  onChange={(e) => setBugSteps(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px] focus:border-rose-500/50"
                />
              </div>

              <Button
                onClick={handleBugSubmit}
                disabled={!bugDescription.trim() || isSubmitting}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Bug className="w-4 h-4 mr-2" />
                    Submit Bug Report
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <UpgradeModal
        isOpen={showMasterPlanUpgrade}
        onClose={() => setShowMasterPlanUpgrade(false)}
        feature="master-plan"
      />
    </>
  )
}
