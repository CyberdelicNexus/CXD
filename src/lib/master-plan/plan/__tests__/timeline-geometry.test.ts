import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GRID,
  clampWindow,
  clockToMinutes,
  defaultDuration,
  dropStart,
  gridHeight,
  hourLabel,
  laneStyle,
  layoutLanes,
  minutesToClock,
  minutesToPx,
  moveBy,
  nowMinutes,
  pxToMinutes,
  rangeLabel,
  resizeBy,
  snap,
} from "../timeline-geometry";

const g = DEFAULT_GRID; // 06:00–24:00, 64px/h, 15-minute snap

describe("clock conversion", () => {
  it("parses and formats HH:mm", () => {
    assert.equal(clockToMinutes("14:30"), 870);
    assert.equal(clockToMinutes("00:00"), 0);
    assert.equal(clockToMinutes("24:00"), null);
    assert.equal(clockToMinutes("9:00"), null);
    assert.equal(clockToMinutes(undefined), null);
    assert.equal(minutesToClock(870), "14:30");
    assert.equal(minutesToClock(2000), "23:59");
    assert.equal(hourLabel(24), "00:00");
    assert.equal(rangeLabel(570, 60), "09:30 – 10:30");
    assert.equal(rangeLabel(1380, 60), "23:00 – 24:00");
  });
  it("maps minutes to pixels and back", () => {
    assert.equal(minutesToPx(6 * 60, g), 0);
    assert.equal(minutesToPx(7 * 60 + 30, g), 96);
    assert.equal(pxToMinutes(96, g), 450);
    assert.equal(gridHeight(g), 18 * 64);
    assert.equal(snap(52), 45);
    assert.equal(snap(53), 60);
  });
});

describe("windows", () => {
  it("keeps a window inside the day", () => {
    assert.deepEqual(clampWindow(23 * 60 + 30, 60, g), { startMin: 23 * 60, durationMin: 60 });
    assert.deepEqual(clampWindow(5 * 60, 60, g), { startMin: 6 * 60, durationMin: 60 });
    assert.deepEqual(clampWindow(600, 5, g), { startMin: 600, durationMin: 15 });
  });
  it("moves by a pixel delta, snapped", () => {
    // +40px = 37.5 min → 637.5 → snaps to 645
    assert.deepEqual(moveBy({ startMin: 600, durationMin: 60 }, 40, g), { startMin: 645, durationMin: 60 });
    assert.deepEqual(moveBy({ startMin: 600, durationMin: 60 }, -10000, g), { startMin: 360, durationMin: 60 });
  });
  it("resizes from either edge, holding the other edge", () => {
    assert.deepEqual(resizeBy({ startMin: 600, durationMin: 60 }, "end", 32, g), { startMin: 600, durationMin: 90 });
    assert.deepEqual(resizeBy({ startMin: 600, durationMin: 60 }, "start", -32, g), { startMin: 570, durationMin: 90 });
    // can't collapse below 15 minutes
    assert.deepEqual(resizeBy({ startMin: 600, durationMin: 60 }, "end", -1000, g), { startMin: 600, durationMin: 15 });
    assert.deepEqual(resizeBy({ startMin: 600, durationMin: 60 }, "start", 1000, g), { startMin: 645, durationMin: 15 });
    // can't leave the day
    assert.deepEqual(resizeBy({ startMin: 1380, durationMin: 30 }, "end", 1000, g), { startMin: 1380, durationMin: 60 });
  });
  it("turns a drop position into a start time", () => {
    assert.equal(dropStart(96, 60, g), 450); // 07:30
    assert.equal(dropStart(100, 60, g), 450); // 07:33.75 → 07:30
    assert.equal(dropStart(gridHeight(g) - 1, 60, g), 23 * 60); // block still fits
    assert.equal(defaultDuration(undefined), 60);
    assert.equal(defaultDuration(0.5), 30);
    assert.equal(defaultDuration(0.1), 15);
  });
  it("shows the now-line only on today", () => {
    const now = new Date(2026, 9, 19, 14, 7);
    assert.equal(nowMinutes("2026-10-19", now), 847);
    assert.equal(nowMinutes("2026-10-20", now), null);
  });
});

describe("overlap lanes", () => {
  it("gives a lone block the full width", () => {
    const m = layoutLanes([{ id: "a", startMin: 600, durationMin: 60 }]);
    assert.deepEqual(m.get("a"), { lane: 0, lanes: 1 });
  });
  it("splits overlapping blocks and reuses freed lanes", () => {
    const m = layoutLanes([
      { id: "a", startMin: 540, durationMin: 120 }, // 09–11
      { id: "b", startMin: 570, durationMin: 30 }, // 09:30–10
      { id: "c", startMin: 600, durationMin: 30 }, // 10–10:30, b's lane is free again
      { id: "d", startMin: 720, durationMin: 30 }, // 12–12:30, new cluster
    ]);
    assert.deepEqual(m.get("a"), { lane: 0, lanes: 2 });
    assert.deepEqual(m.get("b"), { lane: 1, lanes: 2 });
    assert.deepEqual(m.get("c"), { lane: 1, lanes: 2 });
    assert.deepEqual(m.get("d"), { lane: 0, lanes: 1 });
  });
  it("treats touching blocks as not overlapping", () => {
    const m = layoutLanes([
      { id: "a", startMin: 540, durationMin: 60 },
      { id: "b", startMin: 600, durationMin: 60 },
    ]);
    assert.deepEqual(m.get("b"), { lane: 0, lanes: 1 });
  });
  it("computes CSS for lanes", () => {
    assert.deepEqual(laneStyle({ lane: 0, lanes: 1 }, { leftPx: 52, rightPx: 8, gapPx: 4 }), {
      left: "52px",
      width: "calc((100% - 60px) / 1)",
    });
    const s = laneStyle({ lane: 1, lanes: 2 }, { leftPx: 52, rightPx: 8, gapPx: 4 });
    assert.equal(s.width, "calc((100% - 64px) / 2)");
    assert.equal(s.left, "calc(52px + 1 * ((100% - 64px) / 2 + 4px))");
  });
});
