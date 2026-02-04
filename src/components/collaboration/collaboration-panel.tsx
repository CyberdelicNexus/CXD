'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Mail, Trash2, Copy, Check, Loader2, Crown, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CollaboratorPresence, generateUserColor } from '@/hooks/use-collaboration';
import { useSubscription } from '@/hooks/use-subscription';
import { useCXDStore } from '@/store/cxd-store';
import { saveProject } from '@/lib/supabase-projects';

interface Collaborator {
  id: string;
  userId: string;
  role: 'owner' | 'collaborator';
  addedAt: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

interface Invitation {
  id: string;
  invited_email: string;
  status: string;
  created_at: string;
  expires_at: string;
}

interface CollaborationPanelProps {
  canvasId: string;
  canvasName: string;
  isOwner: boolean;
  onlineCollaborators: CollaboratorPresence[];
  onClose: () => void;
}

export function CollaborationPanel({
  canvasId,
  canvasName,
  isOwner,
  onlineCollaborators,
  onClose,
}: CollaborationPanelProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const { subscription } = useSubscription();
  const canInvite = isOwner && subscription?.plan_id !== 'free';

  // Fetch collaborators and invitations
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        // Fetch collaborators
        const collabResponse = await fetch(`/api/canvas/collaborators?canvasId=${canvasId}`);
        const collabData = await collabResponse.json();
        if (collabData.collaborators) {
          setCollaborators(collabData.collaborators);
        }

        // Fetch invitations (only for owners)
        if (isOwner) {
          const inviteResponse = await fetch(`/api/canvas/invite?canvasId=${canvasId}`);
          const inviteData = await inviteResponse.json();
          if (inviteData.invitations) {
            setInvitations(inviteData.invitations);
          }
        }
      } catch (error) {
        console.error('Error fetching collaboration data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [canvasId, isOwner]);

  // Get current project from store for syncing
  const getCurrentProject = useCXDStore((state) => state.getCurrentProject);

  // Send invitation
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      // Ensure project is synced to database before inviting
      const project = getCurrentProject();
      if (project && project.id === canvasId) {
        await saveProject(project);
      }

      const response = await fetch('/api/canvas/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvasId, email: inviteEmail.trim() }),
      });

      const data = await response.json();

      if (data.error) {
        setInviteError(data.error);
      } else if (data.success) {
        setInviteSuccess(`Invitation sent to ${inviteEmail}`);
        setInviteEmail('');
        // Refresh invitations
        const inviteResponse = await fetch(`/api/canvas/invite?canvasId=${canvasId}`);
        const inviteData = await inviteResponse.json();
        if (inviteData.invitations) {
          setInvitations(inviteData.invitations);
        }
      }
    } catch (error) {
      setInviteError('Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  // Revoke invitation
  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/canvas/invite?invitationId=${invitationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      }
    } catch (error) {
      console.error('Error revoking invitation:', error);
    }
  };

  // Remove collaborator
  const handleRemoveCollaborator = async (userId: string) => {
    try {
      const response = await fetch(
        `/api/canvas/collaborators?canvasId=${canvasId}&userId=${userId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setCollaborators((prev) => prev.filter((c) => c.userId !== userId));
      }
    } catch (error) {
      console.error('Error removing collaborator:', error);
    }
  };

  // Copy invite link
  const handleCopyLink = async (inviteUrl: string, inviteId: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(inviteId);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
    }
  };

  // Check if collaborator is online
  const isOnline = (userId: string) => {
    return onlineCollaborators.some((c) => c.id === userId);
  };

  // Use portal to render outside of any parent stacking contexts (navbar backdrop-blur breaks fixed positioning)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const panelContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        // Close when clicking the backdrop (not the panel content)
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-lg border border-white/10 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-white/60" />
            <h2 className="text-lg font-semibold text-white">Collaborators</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-white/60" />
            </div>
          ) : (
            <>
              {/* Invite Form (Owner only) */}
              {isOwner && (
                <div className="mb-6">
                  <h3 className="mb-2 text-sm font-medium text-white/80">
                    Invite Collaborator
                  </h3>
                  {canInvite ? (
                    <form onSubmit={handleInvite} className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="Email address"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="flex-1 border-white/10 bg-white/5 text-white placeholder:text-white/40"
                        disabled={isInviting}
                      />
                      <Button
                        type="submit"
                        disabled={isInviting || !inviteEmail.trim()}
                        className="bg-white text-black hover:bg-white/90"
                      >
                        {isInviting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                      </Button>
                    </form>
                  ) : (
                    <div className="rounded-md bg-white/5 p-3 text-sm text-white/60">
                      <p>Upgrade to Pro to invite collaborators</p>
                    </div>
                  )}
                  {inviteError && (
                    <p className="mt-2 text-sm text-red-400">{inviteError}</p>
                  )}
                  {inviteSuccess && (
                    <p className="mt-2 text-sm text-green-400">{inviteSuccess}</p>
                  )}
                </div>
              )}

              {/* Pending Invitations */}
              {isOwner && invitations.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-2 text-sm font-medium text-white/80">
                    Pending Invitations
                  </h3>
                  <div className="space-y-2">
                    {invitations.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between rounded-md bg-white/5 p-2"
                      >
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-white/40" />
                          <span className="text-sm text-white/80">
                            {invitation.invited_email}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRevokeInvitation(invitation.id)}
                            className="rounded p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-red-400"
                            title="Revoke invitation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Collaborators List */}
              <div>
                <h3 className="mb-2 text-sm font-medium text-white/80">
                  Team Members ({collaborators.length})
                </h3>
                <div className="space-y-2">
                  {collaborators.map((collaborator) => {
                    const online = isOnline(collaborator.userId);
                    const color = generateUserColor(collaborator.userId);

                    return (
                      <div
                        key={collaborator.id}
                        className="flex items-center justify-between rounded-md bg-white/5 p-2"
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className="relative">
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium text-white"
                              style={{
                                backgroundColor: collaborator.avatarUrl
                                  ? undefined
                                  : color,
                              }}
                            >
                              {collaborator.avatarUrl ? (
                                <img
                                  src={collaborator.avatarUrl}
                                  alt={collaborator.name}
                                  className="h-full w-full rounded-full object-cover"
                                />
                              ) : (
                                collaborator.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2)
                              )}
                            </div>
                            {/* Online indicator */}
                            <div
                              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 ${
                                online ? 'bg-green-500' : 'bg-gray-500'
                              }`}
                            />
                          </div>

                          {/* Name and email */}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-white">
                                {collaborator.name}
                              </span>
                              {collaborator.role === 'owner' && (
                                <Crown className="h-3.5 w-3.5 text-yellow-500" />
                              )}
                            </div>
                            <span className="text-xs text-white/40">
                              {collaborator.email}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        {isOwner && collaborator.role !== 'owner' && (
                          <button
                            onClick={() =>
                              handleRemoveCollaborator(collaborator.userId)
                            }
                            className="rounded p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-red-400"
                            title="Remove collaborator"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-4">
          <p className="text-center text-xs text-white/40">
            {canInvite
              ? 'Collaborators can edit the canvas but cannot manage team members.'
              : isOwner
              ? 'Upgrade to Pro to invite up to 3 collaborators.'
              : 'You are a collaborator on this canvas.'}
          </p>
        </div>
      </div>
    </div>
  );

  // Render in portal to escape parent stacking contexts
  if (!mounted) return null;
  return createPortal(panelContent, document.body);
}
