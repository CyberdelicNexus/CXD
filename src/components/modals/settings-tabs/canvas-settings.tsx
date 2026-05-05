"use client";

import React from "react";
import { Grid, Move, Palette, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasSettings } from "@/hooks/use-canvas-settings";

export function CanvasSettings() {
  const { settings, updateSettings } = useCanvasSettings();
  const [defaultFontSize, setDefaultFontSize] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cxd-default-font-size') || '14';
    }
    return '14';
  });
  const [hardwareAccel, setHardwareAccel] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cxd-hardware-accel') !== 'false';
    }
    return true;
  });

  const handleFontSizeChange = (size: string) => {
    setDefaultFontSize(size);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cxd-default-font-size', size);
      document.documentElement.style.setProperty('--default-font-size', `${size}px`);
    }
  };

  const handleHardwareAccelChange = (enabled: boolean) => {
    setHardwareAccel(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cxd-hardware-accel', enabled.toString());
      document.documentElement.style.setProperty('transform', enabled ? 'translateZ(0)' : 'none');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Canvas Settings</h3>
        <p className="text-sm text-muted-foreground">
          Customize your canvas experience and design tools
        </p>
      </div>

      {/* Grid Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Grid className="w-4 h-4 text-purple-400" />
          <h4 className="text-sm font-semibold text-foreground">Grid</h4>
        </div>

        <div className="space-y-3 pl-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Show Grid</label>
              <p className="text-xs text-muted-foreground">Display grid lines on canvas</p>
            </div>
            <button
              onClick={() => updateSettings({ gridVisible: !settings.gridVisible })}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors",
                settings.gridVisible ? "bg-purple-600" : "bg-gray-600"
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform",
                  settings.gridVisible && "translate-x-5"
                )}
              />
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Grid Size (px)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="10"
                max="50"
                step="5"
                value={settings.gridSize}
                onChange={(e) => updateSettings({ gridSize: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="text-sm text-foreground w-12 text-right">{settings.gridSize}px</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Move className="w-4 h-4 text-purple-400" />
          <h4 className="text-sm font-semibold text-foreground">Navigation</h4>
        </div>

        <div className="space-y-3 pl-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Pan Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'space', label: 'Space Key' },
                { value: 'middle-click', label: 'Middle Click' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updateSettings({ panMode: value as 'space' | 'middle-click' })}
                  className={cn(
                    "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                    settings.panMode === value
                      ? "bg-purple-500/20 border-purple-500/30 text-foreground"
                      : "border-border text-muted-foreground hover:bg-white/5"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Zoom Sensitivity</label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Slow</span>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.zoomSensitivity}
                onChange={(e) => updateSettings({ zoomSensitivity: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground">Fast</span>
            </div>
          </div>
        </div>
      </div>

      {/* Default Styles */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-purple-400" />
          <h4 className="text-sm font-semibold text-foreground">Default Styles</h4>
        </div>

        <div className="space-y-3 pl-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Default Font Size</label>
            <p className="text-xs text-muted-foreground">Default text size for new elements</p>
            <select
              value={defaultFontSize}
              onChange={(e) => handleFontSizeChange(e.target.value)}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="12">12px - Small</option>
              <option value="14">14px - Medium</option>
              <option value="16">16px - Large</option>
              <option value="18">18px - Extra Large</option>
            </select>
          </div>
        </div>
      </div>

      {/* Performance */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-purple-400" />
          <h4 className="text-sm font-semibold text-foreground">Performance</h4>
        </div>

        <div className="flex items-center justify-between pl-6">
          <div>
            <label className="text-sm font-medium text-foreground">Hardware Acceleration</label>
            <p className="text-xs text-muted-foreground">Use GPU for smoother rendering</p>
          </div>
          <button
            onClick={() => handleHardwareAccelChange(!hardwareAccel)}
            className={cn(
              "relative w-11 h-6 rounded-full transition-colors",
              hardwareAccel ? "bg-purple-600" : "bg-gray-600"
            )}
          >
            <div
              className={cn(
                "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform",
                hardwareAccel && "translate-x-5"
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
