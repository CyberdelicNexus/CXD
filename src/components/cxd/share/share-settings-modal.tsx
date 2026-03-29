"use client";

import { useState, useRef, useCallback } from "react";
import { useCXDStore } from "@/store/cxd-store";
import { createClient } from "@/supabase/client";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Upload,
  Copy,
  RefreshCw,
  Trash2,
  Check,
  Image as ImageIcon,
  Share2,
  X,
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
  const [uploading, setUploading] = useState<"cover" | "thumbnail" | null>(null);
  const [copied, setCopied] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

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
      // Use same bucket & path pattern as dashboard image uploads
      const fileName = `dashboard-images/${project.id}-share-${type}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from("canvas-uploads")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from("canvas-uploads")
        .getPublicUrl(fileName);
      const updates =
        type === "cover"
          ? { shareCoverImage: publicUrl }
          : { shareThumbnail: publicUrl };
      updateProject(updates);
      toast({ title: `${type === "cover" ? "Cover image" : "Thumbnail"} uploaded` });
    } catch (err) {
      console.error("Upload error:", err);
      toast({ title: "Upload failed", description: String(err) });
    } finally {
      setUploading(null);
    }
  };

  const handleCopyLink = () => {
    if (!shareUrl) {
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
    updateProjectShareToken(project.id, "");
    toast({ title: "Share link revoked" });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }} modal={false}>
      <DialogContent
        className="!max-w-[520px] !w-[calc(100vw-2rem)] !backdrop-blur-xl !border !border-purple-500/25 !rounded-2xl !p-0 !gap-0 [&>button:last-child]:hidden !overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1e0938 0%, #150a28 40%, #0d0618 100%)',
          boxShadow: '0 0 15px rgba(139, 92, 246, 0.25), 0 0 40px rgba(139, 92, 246, 0.12), 0 0 80px rgba(88, 28, 135, 0.15), 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
        }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/20 flex items-center justify-center">
                <Share2 className="w-4 h-4 text-violet-400" />
              </div>
              <h2 className="text-base font-semibold text-white">Share Project</h2>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-white/40 mb-5 ml-[42px]">Customize how your project appears to visitors</p>

            {/* Images row — cover and thumbnail side by side */}
            <div className="flex gap-3 mb-5">
              {/* Cover Image */}
              <div className="flex-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1.5 block">Cover Image</label>
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload("cover", file);
                }} />
                {project.shareCoverImage ? (
                  <div className="relative w-full h-[72px] rounded-lg overflow-hidden border border-white/10 group cursor-pointer" onClick={() => coverInputRef.current?.click()}>
                    <img src={project.shareCoverImage} alt="Cover" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-medium">
                      Change
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    disabled={uploading === "cover"}
                    className="w-full h-[72px] rounded-lg border border-dashed border-white/10 hover:border-violet-500/30 bg-white/[0.02] hover:bg-violet-500/5 transition-all flex flex-col items-center justify-center gap-1"
                  >
                    <Upload className="w-4 h-4 text-white/20" />
                    <span className="text-[10px] text-white/20">
                      {uploading === "cover" ? "Uploading..." : "Upload cover"}
                    </span>
                  </button>
                )}
              </div>

              {/* Thumbnail */}
              <div className="w-20 flex-shrink-0">
                <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1.5 block">Thumbnail</label>
                <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload("thumbnail", file);
                }} />
                {project.shareThumbnail ? (
                  <div className="relative w-full h-[72px] rounded-lg overflow-hidden border border-white/10 group cursor-pointer" onClick={() => thumbInputRef.current?.click()}>
                    <img src={project.shareThumbnail} alt="Thumb" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-medium">
                      Change
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => thumbInputRef.current?.click()}
                    disabled={uploading === "thumbnail"}
                    className="w-full h-[72px] rounded-lg border border-dashed border-white/10 hover:border-violet-500/30 bg-white/[0.02] hover:bg-violet-500/5 transition-all flex flex-col items-center justify-center gap-1"
                  >
                    <ImageIcon className="w-4 h-4 text-white/20" />
                    <span className="text-[10px] text-white/20">
                      {uploading === "thumbnail" ? "..." : "Upload"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5" />

            {/* Share Link */}
            <div className="mb-4">
              <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1.5 block">Share Link</label>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-[11px] text-white/40 truncate font-mono">
                  {shareUrl || "No link generated yet"}
                </div>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white text-[11px] font-medium flex items-center gap-1 transition-all hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] flex-shrink-0"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : shareUrl ? "Copy" : "Generate"}
                </button>
              </div>
            </div>

            {/* Actions */}
            {shareUrl && (
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateNew}
                  className="flex-1 px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-white/50 hover:text-white/70 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                >
                  <RefreshCw className="w-3 h-3" />
                  New Link
                </button>
                <button
                  onClick={handleRevoke}
                  className="px-3 py-2 rounded-lg border border-red-500/10 bg-red-500/[0.03] hover:bg-red-500/10 text-red-400/50 hover:text-red-400/80 text-xs font-medium flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                  Revoke
                </button>
              </div>
            )}
          </div>
      </DialogContent>
    </Dialog>
  );
}
