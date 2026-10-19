/**
 * Decides when a pointer press becomes a drag.
 *
 * Mouse and pen start the gesture immediately. Touch has to share the
 * screen with scrolling, so a finger only "arms" a drag after a long press:
 * if it moves more than CANCEL_PX before LONG_PRESS_MS, the press was a
 * scroll and the gesture is dropped. Tap still opens a task; long-press
 * picks it up.
 *
 * Timers are injected so the state machine is testable without a DOM.
 */

export const LONG_PRESS_MS = 450;
export const CANCEL_PX = 12;

export type ArmMode = 'immediate' | 'long-press';

export function armMode(pointerType: string): ArmMode {
  return pointerType === 'mouse' || pointerType === 'pen' ? 'immediate' : 'long-press';
}

export interface TimerApi {
  set: (fn: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

const browserTimers: TimerApi = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface TouchArm {
  /**
   * Start tracking a press. Runs `onArm` now for mouse/pen (returns true),
   * or after the long press for touch (returns false).
   */
  begin(p: { pointerType: string; x: number; y: number }, onArm: () => void): boolean;
  /** Feed pointer movement. Returns true if this movement cancelled a pending long press. */
  move(p: { x: number; y: number }): boolean;
  end(): void;
  readonly armed: boolean;
  readonly pending: boolean;
}

export function createTouchArm(timers: TimerApi = browserTimers): TouchArm {
  let timer: unknown = null;
  let origin: { x: number; y: number } | null = null;
  let armed = false;

  const clearTimer = () => {
    if (timer !== null) timers.clear(timer);
    timer = null;
  };

  return {
    begin(p, onArm) {
      clearTimer();
      armed = false;
      if (armMode(p.pointerType) === 'immediate') {
        armed = true;
        onArm();
        return true;
      }
      origin = { x: p.x, y: p.y };
      timer = timers.set(() => {
        timer = null;
        armed = true;
        onArm();
      }, LONG_PRESS_MS);
      return false;
    },
    move(p) {
      if (timer === null || !origin) return false;
      const dx = p.x - origin.x;
      const dy = p.y - origin.y;
      if (dx * dx + dy * dy > CANCEL_PX * CANCEL_PX) {
        clearTimer();
        origin = null;
        return true;
      }
      return false;
    },
    end() {
      clearTimer();
      origin = null;
      armed = false;
    },
    get armed() {
      return armed;
    },
    get pending() {
      return timer !== null;
    },
  };
}
