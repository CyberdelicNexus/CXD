"use client";

import React, { useState } from "react";
import { Eye, EyeOff, Key, Check, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApiKeyConfig {
  provider: 'openai' | 'anthropic';
  label: string;
  placeholder: string;
  helpText: string;
  helpLink: string;
}

const API_KEY_CONFIGS: ApiKeyConfig[] = [
  {
    provider: 'anthropic',
    label: 'Anthropic API Key',
    placeholder: 'sk-ant-...',
    helpText: 'For Claude models (Sonnet, Opus, Haiku)',
    helpLink: 'https://console.anthropic.com/settings/keys',
  },
];

interface ApiKeyManagerProps {
  onSave: (keys: Record<string, string>) => Promise<void>;
  initialKeys?: Record<string, string>;
}

export function ApiKeyManager({ onSave, initialKeys = {} }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState<Record<string, string>>(initialKeys);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleKeyChange = (provider: string, value: string) => {
    setKeys(prev => ({ ...prev, [provider]: value }));
    setSaveStatus('idle');
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      await onSave(keys);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
      console.error('Failed to save API keys:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const hasAnyKeys = Object.values(keys).some(key => key.trim().length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg">
        <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Bring Your Own API Keys
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            As a Lifetime member, you can use your own API keys to access premium AI models without consuming credits.
            Your keys are encrypted and stored securely.
          </p>
        </div>
      </div>

      {/* API Key Inputs */}
      <div className="space-y-4">
        {API_KEY_CONFIGS.map((config) => {
          const value = keys[config.provider] || '';
          const isVisible = showKeys[config.provider] || false;

          return (
            <div key={config.provider} className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Key className="w-4 h-4 text-muted-foreground" />
                {config.label}
              </label>

              <div className="relative">
                <input
                  type={isVisible ? 'text' : 'password'}
                  value={value}
                  onChange={(e) => handleKeyChange(config.provider, e.target.value)}
                  placeholder={config.placeholder}
                  className={cn(
                    "w-full px-4 py-2.5 pr-12 bg-background border rounded-lg",
                    "text-sm font-mono text-foreground placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500",
                    "transition-all"
                  )}
                />
                <button
                  type="button"
                  onClick={() => toggleShowKey(config.provider)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isVisible ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs">
                <p className="text-muted-foreground">
                  {config.helpText}
                </p>
                <a
                  href={config.helpLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 underline"
                >
                  Get API Key →
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        {saveStatus === 'success' && (
          <div className="flex items-center gap-2 text-sm text-green-400">
            <Check className="w-4 h-4" />
            API keys saved successfully
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="w-4 h-4" />
            Failed to save API keys
          </div>
        )}
        {saveStatus === 'idle' && <div />}

        <button
          onClick={handleSave}
          disabled={isSaving || !hasAnyKeys}
          className={cn(
            "px-6 py-2.5 rounded-lg font-medium text-sm transition-all",
            "bg-purple-600 hover:bg-purple-700 text-white",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center gap-2"
          )}
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Key className="w-4 h-4" />
              Save API Keys
            </>
          )}
        </button>
      </div>

      {/* Security Notice */}
      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-xs text-blue-300 leading-relaxed">
          🔒 Your API keys are encrypted using AES-256 before storage and are never shared with third parties.
          They are only used to make API calls on your behalf to the respective providers.
        </p>
      </div>
    </div>
  );
}
