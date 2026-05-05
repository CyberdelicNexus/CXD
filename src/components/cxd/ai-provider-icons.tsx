import type { AIProviderKey } from "@/types/ai-types";
import type { ModelId } from "@/lib/ai-credit-config";
import { AI_MODELS } from "@/lib/ai-credit-config";

interface AIProviderIconProps {
  provider: AIProviderKey | ModelId | string;
  className?: string;
}

function AnthropicIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0h3.767L16.906 20.48h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm1.24 4.145L5.12 14.04h5.37L7.81 7.665z" />
    </svg>
  );
}

function GeminiIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C12 6.627 6.627 12 0 12c6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12z" />
    </svg>
  );
}

function MoonshotIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  );
}

// Helper to extract provider from model ID
function getProviderFromModelId(modelId: string): string {
  // Check if it's a new model ID
  const model = AI_MODELS[modelId as ModelId];
  if (model) {
    return model.provider;
  }

  // Fallback to legacy provider keys
  if (modelId.includes('claude')) return 'anthropic';
  if (modelId.includes('gemini')) return 'google';
  if (modelId.includes('kimi')) return 'moonshot';

  return modelId; // Return as-is for legacy keys
}

export function AIProviderIcon({ provider, className = "w-4 h-4" }: AIProviderIconProps) {
  const providerName = getProviderFromModelId(provider);

  switch (providerName) {
    case "anthropic":
    case "claude":
      return <AnthropicIcon className={className} />;
    case "google":
    case "gemini":
      return <GeminiIcon className={className} />;
    case "moonshot":
    case "kimi":
      return <MoonshotIcon className={className} />;
    default:
      return null;
  }
}
