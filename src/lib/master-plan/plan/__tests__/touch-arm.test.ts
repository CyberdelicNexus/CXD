import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CANCEL_PX, LONG_PRESS_MS, armMode, createTouchArm, type TimerApi } from "../touch-arm";

function fakeTimers() {
  let pending: { fn: () => void; ms: number } | null = null;
  const api: TimerApi = {
    set: (fn, ms) => {
      pending = { fn, ms };
      return pending;
    },
    clear: (h) => {
      if (h === pending) pending = null;
    },
  };
  return {
    api,
    fire: () => {
      const p = pending;
      pending = null;
      p?.fn();
    },
    get ms() {
      return pending?.ms;
    },
  };
}

describe("touch arm", () => {
  it("arms mouse and pen immediately", () => {
    assert.equal(armMode("mouse"), "immediate");
    assert.equal(armMode("pen"), "immediate");
    assert.equal(armMode("touch"), "long-press");
    assert.equal(armMode(""), "long-press");
    const arm = createTouchArm(fakeTimers().api);
    let ran = 0;
    assert.equal(arm.begin({ pointerType: "mouse", x: 0, y: 0 }, () => ran++), true);
    assert.equal(ran, 1);
    assert.equal(arm.armed, true);
  });
  it("arms touch after a long press", () => {
    const timers = fakeTimers();
    const arm = createTouchArm(timers.api);
    let ran = 0;
    assert.equal(arm.begin({ pointerType: "touch", x: 10, y: 10 }, () => ran++), false);
    assert.equal(timers.ms, LONG_PRESS_MS);
    assert.equal(arm.pending, true);
    assert.equal(arm.move({ x: 15, y: 15 }), false); // a small wobble keeps the press
    timers.fire();
    assert.equal(ran, 1);
    assert.equal(arm.armed, true);
    arm.end();
    assert.equal(arm.armed, false);
  });
  it("treats movement past the tolerance as a scroll", () => {
    const timers = fakeTimers();
    const arm = createTouchArm(timers.api);
    let ran = 0;
    arm.begin({ pointerType: "touch", x: 0, y: 0 }, () => ran++);
    assert.equal(arm.move({ x: 0, y: CANCEL_PX + 1 }), true);
    assert.equal(arm.pending, false);
    timers.fire();
    assert.equal(ran, 0);
    assert.equal(arm.armed, false);
  });
});
