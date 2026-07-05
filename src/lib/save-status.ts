/**
 * Save Status Events
 *
 * Both persistence layers (JSON project sync + Yjs binary persistence) emit
 * status events through this module so the UI can show a single unified
 * save indicator. Sources report independently; the indicator combines them
 * (error wins over saving, saving wins over saved).
 */

export type SaveStatusKind = 'saving' | 'saved' | 'error';
export type SaveSource = 'project' | 'yjs';

export interface SaveStatusDetail {
  status: SaveStatusKind;
  source: SaveSource;
  message?: string;
  failures?: number;
}

export const SAVE_STATUS_EVENT = 'cxd-save-status';

export function emitSaveStatus(detail: SaveStatusDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SaveStatusDetail>(SAVE_STATUS_EVENT, { detail }));
}
