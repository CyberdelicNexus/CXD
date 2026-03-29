"use client";

import { useState, useRef, useCallback } from "react";
import { useCXDStore } from "@/store/cxd-store";
import { createClient } from "@/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Copy,
  RefreshCw,
  Trash2,
  Check,
  Image as ImageIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateProjectShareToken } from "@/lib/supabase-projects";

interface ShareSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ShareSettingsModal({ open, onClose }: ShareSettingsModalProps) {
  const { getCurrentProject, generateShareToken } = useCXDStore();
  const project = getCurrentProject();
  const { toast } = useToast();
  const [uploading, setUploading] = useState<"cover" | "thumbnail" | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  // Helper to update arbitrary fields on the current project in the store.
  // The store does not expose a generic `syncUpdateProject`, so we replicate
  // the pattern used by `generateShareToken` — direct setState with map.
  const updateProject = useCallback(
    (updates: Record<string, unknown>) => {
      if (!project) return;
      useCXDStore.setState((state) => ({
        projects: state.projects.map((p) =>
          p.id === project.id
            ? { ...p, ...updates, updatedAt: new Date().toISOString() }
            : p
        ),
      }));
    },
    [project]
  );

  if (!project) return null;

  const shareUrl = project.shareToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/cxd/share/${project.shareToken}`
    : null;

  const handleUpload = async (type: "cover" | "thumbnail", file: File) => {
    setUploading(type);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `share/${project.id}/${type}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from("project-assets")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from("project-assets")
        .getPublicUrl(data.path);
      const updates =
        type === "cover"
          ? { shareCoverImage: urlData.publicUrl }
          : { shareThumbnail: urlData.publicUrl };
      updateProject(updates);
      toast({
        title: `${type === "cover" ? "Cover image" : "Thumbnail"} uploaded`,
      });
    } catch (err) {
      console.error("Upload error:", err);
      toast({ title: "Upload failed", description: "Please try again" });
    } finally {
      setUploading(null);
    }
  };

  const handleCopyLink = () => {
    if (!shareUrl) {
      // Generate token first
      const token = generateShareToken();
      const url = `${window.location.origin}/cxd/share/${token}`;
      navigator.clipboard.writeText(url);
    } else {
      navigator.clipboard.writeText(shareUrl);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copied to clipboard" });
  };

  const handleGenerateNew = () => {
    generateShareToken();
    toast({ title: "New share link generated" });
  };

  const handleRevoke = () => {
    updateProject({ shareToken: undefined });
    // Also clear the token in the database
    updateProjectShareToken(project.id, "");
    toast({ title: "Share link revoked" });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      modal={false}
    >
      <DialogContent
        className="bg-zinc-900/95 backdrop-blur-xl border-white/10 text-white sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Share Project</DialogTitle>
          <DialogDescription className="text-white/50">
            Customize how your project appears to visitors
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Cover Image */}
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium mb-2 block">
              Cover Image
            </label>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload("cover", file);
              }}
            />
            {project.shareCoverImage ? (
              <div className="relative w-full h-24 rounded-xl overflow-hidden border border-white/10 group">
                <img
                  src={project.shareCoverImage}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                onClick={() => coverInputRef.current?.click()}
                disabled={uploading === "cover"}
                className="w-full h-24 rounded-xl border-2 border-dashed border-purple-500/20 hover:border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10 transition-all flex flex-col items-center justify-center gap-1"
              >
                <Upload className="w-5 h-5 text-white/30" />
                <span className="text-xs text-white/30">
                  {uploading === "cover"
                    ? "Uploading..."
                    : "Upload cover image"}
                </span>
              </button>
            )}
          </div>

          {/* Thumbnail */}
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium mb-2 block">
              Project Thumbnail
            </label>
            <input
              ref={thumbInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload("thumbnail", file);
              }}
            />
            {project.shareThumbnail ? (
              <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-white/10 group">
                <img
                  src={project.shareThumbnail}
                  alt="Thumbnail"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => thumbInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                onClick={() => thumbInputRef.current?.click()}
                disabled={uploading === "thumbnail"}
                className="w-32 h-20 rounded-lg border-2 border-dashed border-purple-500/20 hover:border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10 transition-all flex flex-col items-center justify-center gap-1"
              >
                <ImageIcon className="w-4 h-4 text-white/30" />
                <span className="text-[10px] text-white/30">
                  {uploading === "thumbnail" ? "Uploading..." : "Upload"}
                </span>
              </button>
            )}
          </div>

          {/* Share Link */}
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium mb-2 block">
              Share Link
            </label>
            <div className="flex gap-2">
              <div className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/50 overflow-hidden text-ellipsis whitespace-nowrap">
                {shareUrl || "No link generated yet"}
              </div>
              <Button
                onClick={handleCopyLink}
                size="sm"
                className="bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white text-xs gap-1.5"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? "Copied" : shareUrl ? "Copy" : "Generate & Copy"}
              </Button>
            </div>
          </div>

          {/* Actions */}
          {shareUrl && (
            <div className="flex gap-2">
              <Button
                onClick={handleGenerateNew}
                variant="outline"
                size="sm"
                className="flex-1 border-purple-500/30 text-purple-300 hover:bg-purple-500/10 gap-1.5 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                New Link
              </Button>
              <Button
                onClick={handleRevoke}
                variant="outline"
                size="sm"
                className="border-red-500/20 text-red-400/70 hover:bg-red-500/10 gap-1.5 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Revoke
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
