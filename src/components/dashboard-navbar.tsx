'use client'

import { useState } from 'react'
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
  HelpCircle,
  Bell,
  FileText,
  Bug,
  MessageCircle,
  Send,
  X,
  LayoutGrid,
  Play,
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
  Loader2
} from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationType, Notification } from '@/lib/notifications'

const notificationIcons: Record<NotificationType, React.ReactNode> = {
  info: <Info className="w-4 h-4 text-blue-400" />,
  success: <CheckCircle className="w-4 h-4 text-green-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  announcement: <Megaphone className="w-4 h-4 text-purple-400" />,
  update: <Sparkles className="w-4 h-4 text-cyan-400" />,
  project: <FolderOpen className="w-4 h-4 text-orange-400" />,
};

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

export default function DashboardNavbar() {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, clearAll, refresh } = useNotifications()
  const [acceptingInvite, setAcceptingInvite] = useState<string | null>(null)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [showBugModal, setShowBugModal] = useState(false)
  const [supportMessage, setSupportMessage] = useState('')
  const [bugDescription, setBugDescription] = useState('')
  const [bugSteps, setBugSteps] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

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
          title: 'Support Request',
          description: supportMessage,
          browserInfo,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSubmitSuccess(true)
        // Close dialog after brief success display
        setTimeout(() => {
          setShowSupportModal(false)
        }, 1500)
      } else {
        throw new Error(data.error || 'Failed to submit support request')
      }
    } catch (error) {
      console.error('Support submission error:', error)
      alert('Failed to submit support request. Please try again or email contact@cyberdelic.design')
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
        }, 1500)
      } else {
        throw new Error(data.error || 'Failed to submit bug report')
      }
    } catch (error) {
      console.error('Bug report submission error:', error)
      alert('Failed to submit bug report. Please try again or email contact@cyberdelic.design')
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
      <nav className="w-full border-b border-white/10 bg-black/60 backdrop-blur-sm sticky top-0 z-50 overflow-visible">
        {/* Glass Reflection Effects */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-30" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

        <div className="container mx-auto px-4 flex justify-between items-center max-w-7xl h-20">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 group px-3 py-2 rounded-full transition-all duration-300 hover:bg-white/5 pr-4">
              <Image
                src="/images/hypercube-logo.webp"
                alt="CXD"
                width={28}
                height={28}
                className="object-contain"
              />
              <span className="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[200px] group-hover:opacity-100 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] whitespace-nowrap font-medium text-sm text-white/90">
                Cyberdelic Design Canvas
              </span>
            </Link>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-2">
              {[
                { id: 'dashboard', href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
                { id: 'docs', href: '/dashboard/docs', icon: BookOpen, label: 'Documentation' },
              ].map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link key={item.id} href={item.href}>
                    <div className={`relative flex items-center px-4 py-2 group rounded-full text-white/90 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] border shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] active:scale-95 overflow-hidden cursor-pointer
                      ${isActive
                        ? 'bg-violet-500/20 border-violet-500/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_0_20px_rgba(139,92,246,0.2)]'
                        : 'bg-white/[0.03] border-white/[0.08] hover:bg-violet-500/20 hover:border-violet-500/30 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_0_20px_rgba(139,92,246,0.2)]'
                      }`}
                    >
                      <item.icon className={`w-4 h-4 mr-2 transition-colors ${isActive ? 'text-violet-200' : 'text-white/60 group-hover:text-violet-200'}`} />
                      <span className="text-xs font-medium">{item.label}</span>
                      {/* Subtle inner top highlight */}
                      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      {/* Subtle bottom glow */}
                      <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  </Link>
                );
              })}

              {/* Templates nav link — hidden until templates are production-ready */}

              {/* Locked Links */}
              {[
                { id: 'tutorials', icon: Play, label: 'Tutorials' },
              ].map((item) => (
                <div key={item.id} className="relative group">
                  <div className="flex items-center px-4 py-2 rounded-full text-white/40 bg-white/[0.02] border border-white/[0.05] transition-all duration-300 cursor-not-allowed">
                    <item.icon className="w-4 h-4 mr-2 opacity-50" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-zinc-900 text-white text-[10px] rounded-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[60]">
                    Coming soon
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 items-center">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="relative group cursor-pointer active:scale-95 transition-all">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.08] group-hover:bg-violet-500/20 group-hover:border-violet-500/30 transition-all duration-300">
                    <Bell className="h-5 w-5 text-white/60 group-hover:text-violet-200" />
                    {unreadCount > 0 && (
                      <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(139,92,246,1)]" />
                    )}
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-900/95 backdrop-blur-xl border-white/10 w-80">
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
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
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
                <div className="group cursor-pointer active:scale-95 transition-all">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.08] group-hover:bg-violet-500/20 group-hover:border-violet-500/30 transition-all duration-300">
                    <HelpCircle className="h-5 w-5 text-white/60 group-hover:text-violet-200" />
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-900/95 backdrop-blur-xl border-white/10 w-48">
                <DropdownMenuItem
                  onClick={() => setShowSupportModal(true)}
                  className="cursor-pointer hover:bg-white/5"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Contact Support
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowBugModal(true)}
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
                <div className="group cursor-pointer active:scale-95 transition-all">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.08] group-hover:bg-violet-500/20 group-hover:border-violet-500/30 transition-all duration-300">
                    <UserCircle className="h-6 w-6 text-white/60 group-hover:text-violet-200" />
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-900/95 backdrop-blur-xl border-white/10 w-48">
                <DropdownMenuItem onClick={() => router.push('/dashboard/profile')} className="cursor-pointer hover:bg-white/5">
                  <UserCircle className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/dashboard/settings')} className="cursor-pointer hover:bg-white/5">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive hover:bg-destructive/10">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
              Contact Support
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Have a question or need help? We're here to assist you.
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
                  placeholder="Describe your question or issue..."
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
    </>
  )
}
