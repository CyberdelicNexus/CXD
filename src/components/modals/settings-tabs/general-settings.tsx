"use client";

import React from "react";
import { Globe } from "lucide-react";
import { useCXDStore } from "@/store/cxd-store";

export function GeneralSettings() {
  const { defaultView, setDefaultView } = useCXDStore();
  const [language, setLanguage] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cxd-language') || 'en';
    }
    return 'en';
  });

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cxd-language', newLanguage);
      // Apply language change to document
      document.documentElement.lang = newLanguage;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">General Settings</h3>
        <p className="text-sm text-muted-foreground">
          Customize your CXD Canvas experience
        </p>
      </div>

      {/* Language */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Language
        </label>
        <p className="text-xs text-muted-foreground">
          Select your preferred language for the interface
        </p>
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="en">English</option>
          <option value="es">Español (Spanish)</option>
          <option value="de">Deutsch (German)</option>
          <option value="fr">Français (French)</option>
        </select>
      </div>

      {/* Default View */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Default View</label>
        <p className="text-xs text-muted-foreground">
          Choose which view opens when you load a canvas
        </p>
        <select
          value={defaultView || 'canvas'}
          onChange={(e) => setDefaultView(e.target.value as 'canvas' | 'hexagon' | 'plan')}
          className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="canvas">Canvas View</option>
          <option value="hexagon">Map View (Hypercube)</option>
          <option value="plan">Plan View</option>
        </select>
      </div>
    </div>
  );
}
