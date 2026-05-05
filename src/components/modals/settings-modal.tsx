"use client";

import React, { useState } from "react";
import {
  Settings,
  User,
  Palette,
  Sparkles,
  Info,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Import tab components
import { GeneralSettings } from "./settings-tabs/general-settings";
import { AISettings } from "./settings-tabs/ai-settings";
import { CanvasSettings } from "./settings-tabs/canvas-settings";
import { AccountSettings } from "./settings-tabs/account-settings";
import { AboutSettings } from "./settings-tabs/about-settings";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: SettingsTab;
}

export type SettingsTab = 'general' | 'ai' | 'canvas' | 'account' | 'about';

const TABS = [
  {
    id: 'general' as const,
    label: 'General',
    icon: Settings,
    description: 'App preferences and defaults',
  },
  {
    id: 'ai' as const,
    label: 'AI',
    icon: Sparkles,
    description: 'AI models and credits',
  },
  {
    id: 'canvas' as const,
    label: 'Canvas',
    icon: Palette,
    description: 'Canvas and design settings',
  },
  {
    id: 'account' as const,
    label: 'Account',
    icon: User,
    description: 'Profile and subscription',
  },
  {
    id: 'about' as const,
    label: 'About',
    icon: Info,
    description: 'Version and changelog',
  },
];

export function SettingsModal({ isOpen, onClose, defaultTab = 'general' }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);

  // Reset to default tab when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettings />;
      case 'ai':
        return <AISettings />;
      case 'canvas':
        return <CanvasSettings />;
      case 'account':
        return <AccountSettings />;
      case 'about':
        return <AboutSettings />;
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-4xl max-h-[85vh] overflow-hidden bg-background/95 backdrop-blur-xl border-border p-0"
      >
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-purple-400" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[calc(85vh-100px)]">
          {/* Sidebar */}
          <div className="w-56 border-r border-border p-4 space-y-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-purple-500/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-500/70">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all text-left group",
                    isActive
                      ? "bg-purple-500/20 border border-purple-500/30"
                      : "hover:bg-white/5 border border-transparent"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 mt-0.5 flex-shrink-0",
                      isActive ? "text-purple-400" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        "text-sm font-medium",
                        isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    >
                      {tab.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {tab.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-purple-500/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-500/70">
            {renderTabContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
