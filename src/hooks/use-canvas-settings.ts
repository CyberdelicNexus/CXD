'use client';

import { useState, useEffect, useCallback } from 'react';

export interface CanvasSettings {
  gridVisible: boolean;
  gridMajorDots: boolean; // second, brighter dot layer every Nth cell
  gridSize: number;
  panMode: 'space' | 'middle-click';
  zoomSensitivity: number; // 0-100 slider value
}

const DEFAULT_SETTINGS: CanvasSettings = {
  gridVisible: true,
  gridMajorDots: false,
  gridSize: 20,
  panMode: 'space',
  zoomSensitivity: 50,
};

// Convert 0-100 slider to actual zoom sensitivity (0.0005 to 0.002)
export function getZoomSensitivityValue(sliderValue: number): number {
  // Map 0-100 to 0.0005-0.002
  return 0.0005 + (sliderValue / 100) * 0.0015;
}

export function useCanvasSettings() {
  const [settings, setSettings] = useState<CanvasSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;

    return {
      gridVisible: localStorage.getItem('cxd-grid-visible') !== 'false',
      gridMajorDots: localStorage.getItem('cxd-grid-major-dots') === 'true',
      gridSize: parseInt(localStorage.getItem('cxd-grid-size') || '20'),
      panMode: (localStorage.getItem('cxd-pan-mode') as 'space' | 'middle-click') || 'space',
      zoomSensitivity: parseInt(localStorage.getItem('cxd-zoom-sensitivity') || '50'),
    };
  });

  // Listen for settings changes from other components
  useEffect(() => {
    const handleSettingsChange = () => {
      if (typeof window === 'undefined') return;

      setSettings({
        gridVisible: localStorage.getItem('cxd-grid-visible') !== 'false',
        gridMajorDots: localStorage.getItem('cxd-grid-major-dots') === 'true',
        gridSize: parseInt(localStorage.getItem('cxd-grid-size') || '20'),
        panMode: (localStorage.getItem('cxd-pan-mode') as 'space' | 'middle-click') || 'space',
        zoomSensitivity: parseInt(localStorage.getItem('cxd-zoom-sensitivity') || '50'),
      });
    };

    window.addEventListener('canvas-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('canvas-settings-changed', handleSettingsChange);
  }, []);

  const updateSettings = useCallback((updates: Partial<CanvasSettings>) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...updates };

      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('cxd-grid-visible', newSettings.gridVisible.toString());
        localStorage.setItem('cxd-grid-major-dots', newSettings.gridMajorDots.toString());
        localStorage.setItem('cxd-grid-size', newSettings.gridSize.toString());
        localStorage.setItem('cxd-pan-mode', newSettings.panMode);
        localStorage.setItem('cxd-zoom-sensitivity', newSettings.zoomSensitivity.toString());

        // Notify other components
        window.dispatchEvent(new CustomEvent('canvas-settings-changed'));
      }

      return newSettings;
    });
  }, []);

  return {
    settings,
    updateSettings,
    zoomSensitivity: getZoomSensitivityValue(settings.zoomSensitivity),
  };
}
