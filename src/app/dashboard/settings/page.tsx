"use client";

import React from "react";
import { SettingsModal } from "@/components/modals/settings-modal";
import { useRouter, useSearchParams } from "next/navigation";

export default function SettingsPage() {
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
