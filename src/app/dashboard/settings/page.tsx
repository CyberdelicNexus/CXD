"use client";

import React, { Suspense } from "react";
import { SettingsModal } from "@/components/modals/settings-modal";
import { useRouter, useSearchParams } from "next/navigation";

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab = (searchParams.get('tab') || 'general') as any;

  const handleClose = () => {
    router.back();
  };

  return (
    <SettingsModal
      isOpen={true}
      onClose={handleClose}
      defaultTab={defaultTab}
    />
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}
