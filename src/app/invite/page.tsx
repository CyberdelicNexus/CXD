'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InviteState {
  status: 'loading' | 'requiresAuth' | 'success' | 'error';
  message?: string;
  canvasId?: string;
  canvasName?: string;
  invitedEmail?: string;
  currentEmail?: string;
}

export default function InvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<InviteState>({ status: 'loading' });

  useEffect(() => {
    if (!token) {
      setState({
        status: 'error',
        message: 'Invalid invitation link. No token provided.',
      });
      return;
    }

    // Accept the invitation
    async function acceptInvite() {
      try {
        const response = await fetch(`/api/canvas/invite/accept?token=${token}`);
        const data = await response.json();

        if (data.requiresAuth) {
          // Store token for after auth
          sessionStorage.setItem('pendingInviteToken', token);
          setState({
            status: 'requiresAuth',
            canvasName: data.canvasName,
            invitedEmail: data.invitedEmail,
          });
          return;
        }

        if (data.error) {
          setState({
            status: 'error',
            message: data.error,
            invitedEmail: data.invitedEmail,
            currentEmail: data.currentEmail,
          });
          return;
        }

        if (data.success) {
          setState({
            status: 'success',
            canvasId: data.canvasId,
            canvasName: data.canvasName,
            message: data.message,
          });
        }
      } catch (error) {
        console.error('Error accepting invitation:', error);
        setState({
          status: 'error',
          message: 'Failed to accept invitation. Please try again.',
        });
      }
    }

    acceptInvite();
  }, [token]);

  const handleSignIn = () => {
    // Redirect to login with return URL
    router.push(`/login?returnTo=/invite?token=${token}`);
  };

  const handleSignUp = () => {
    // Redirect to signup with return URL and pre-filled email
    const params = new URLSearchParams({
      returnTo: `/invite?token=${token}`,
    });
    if (state.invitedEmail) {
      params.set('email', state.invitedEmail);
    }
    router.push(`/signup?${params.toString()}`);
  };

  const handleGoToCanvas = () => {
    if (state.canvasId) {
      router.push(`/canvas?id=${state.canvasId}`);
    }
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm">
        {state.status === 'loading' && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-white/60" />
            <h1 className="mt-4 text-xl font-semibold text-white">
              Processing Invitation
            </h1>
            <p className="mt-2 text-white/60">
              Please wait while we verify your invitation...
            </p>
          </>
        )}

        {state.status === 'requiresAuth' && (
          <>
            <AlertCircle className="mx-auto h-12 w-12 text-yellow-400" />
            <h1 className="mt-4 text-xl font-semibold text-white">
              Sign In Required
            </h1>
            <p className="mt-2 text-white/60">
              You've been invited to collaborate on{' '}
              <span className="font-medium text-white">
                {state.canvasName || 'a canvas'}
              </span>
            </p>
            {state.invitedEmail && (
              <p className="mt-2 text-sm text-white/40">
                Invitation sent to: {state.invitedEmail}
              </p>
            )}
            <div className="mt-6 flex flex-col gap-3">
              <Button
                onClick={handleSignIn}
                className="w-full bg-white text-black hover:bg-white/90"
              >
                Sign In
              </Button>
              <Button
                onClick={handleSignUp}
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
              >
                Create Account
              </Button>
            </div>
          </>
        )}

        {state.status === 'success' && (
          <>
            <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
            <h1 className="mt-4 text-xl font-semibold text-white">
              Invitation Accepted!
            </h1>
            <p className="mt-2 text-white/60">
              {state.message || 'You can now collaborate on this canvas.'}
            </p>
            {state.canvasName && (
              <p className="mt-2 text-sm text-white/40">
                Canvas: {state.canvasName}
              </p>
            )}
            <div className="mt-6 flex flex-col gap-3">
              <Button
                onClick={handleGoToCanvas}
                className="w-full bg-white text-black hover:bg-white/90"
              >
                Open Canvas
              </Button>
              <Button
                onClick={handleGoToDashboard}
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
              >
                Go to Dashboard
              </Button>
            </div>
          </>
        )}

        {state.status === 'error' && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-red-400" />
            <h1 className="mt-4 text-xl font-semibold text-white">
              Invitation Error
            </h1>
            <p className="mt-2 text-white/60">
              {state.message || 'Something went wrong.'}
            </p>
            {state.invitedEmail && state.currentEmail && (
              <div className="mt-4 rounded-md bg-red-500/10 p-3 text-sm">
                <p className="text-red-300">
                  This invitation was sent to{' '}
                  <span className="font-medium">{state.invitedEmail}</span>
                </p>
                <p className="mt-1 text-red-300/70">
                  You're signed in as{' '}
                  <span className="font-medium">{state.currentEmail}</span>
                </p>
              </div>
            )}
            <div className="mt-6">
              <Button
                onClick={handleGoToDashboard}
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
              >
                Go to Dashboard
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
