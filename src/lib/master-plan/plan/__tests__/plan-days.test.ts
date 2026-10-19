import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  compareInDay,
  daysForView,
  formatMinutes,
  isBacklog,
  isCarriedOver,
  positionBetween,
  reorderWrites,
  startOfWeek,
  stepForView,
  taskMinutes,
  type PlanTaskLike,
} from "../plan-days";

const t = (p: Partial<PlanTaskLike> & { id: string }): PlanTaskLike => ({ title: p.id, status: "not_started", ...p });

describe("day maths", () => {
  it("adds days across month and year boundaries", () => {
    assert.equal(addDays("2026-10-31", 1), "2026-11-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });
  it("finds the Monday of a week, including from a Sunday", () => {
    assert.equal(startOfWeek("2026-10-19"), "2026-10-19"); // Monday
    assert.equal(startOfWeek("2026-10-25"), "2026-10-19"); // Sunday
    assert.equal(startOfWeek("2026-10-21"), "2026-10-19");
  });
  it("builds each view's days from the anchor", () => {
    assert.deepEqual(daysForView("day", "2026-10-21"), ["2026-10-21"]);
    assert.deepEqual(daysForView("three", "2026-10-21"), ["2026-10-21", "2026-10-22", "2026-10-23"]);
    assert.equal(daysForView("week", "2026-10-21")[0], "2026-10-19");
    assert.equal(daysForView("week", "2026-10-21").length, 7);
    assert.equal(daysForView("board", "2026-10-21")[0], "2026-10-21");
    assert.equal(stepForView("day"), 1);
    assert.equal(stepForView("three"), 3);
    assert.equal(stepForView("board"), 7);
  });
});

describe("plan state", () => {
  it("separates backlog from carried-over tasks", () => {
    assert.equal(isBacklog(t({ id: "a" })), true);
    assert.equal(isBacklog(t({ id: "a", plannedDate: "2026-10-19" })), false);
    assert.equal(isBacklog(t({ id: "a", status: "completed" })), false);
    assert.equal(isBacklog(t({ id: "a", isArchived: true })), false);
    assert.equal(isCarriedOver(t({ id: "a", plannedDate: "2026-10-18" }), "2026-10-19"), true);
    assert.equal(isCarriedOver(t({ id: "a", plannedDate: "2026-10-19" }), "2026-10-19"), false);
    assert.equal(isCarriedOver(t({ id: "a", plannedDate: "2026-10-18", status: "completed" }), "2026-10-19"), false);
  });
  it("sorts done last, then manual order, then time", () => {
    const list = [
      t({ id: "done", status: "completed", planOrder: 1 }),
      t({ id: "unordered-late", scheduledStart: "15:00" }),
      t({ id: "second", planOrder: 2000 }),
      t({ id: "first", planOrder: 1000 }),
      t({ id: "unordered-early", scheduledStart: "09:00" }),
    ].sort(compareInDay);
    assert.deepEqual(list.map((x) => x.id), ["first", "second", "unordered-early", "unordered-late", "done"]);
  });
  it("counts block length before estimate", () => {
    assert.equal(taskMinutes({ durationMinutes: 45, estimatedHours: 2 }), 45);
    assert.equal(taskMinutes({ estimatedHours: 1.5 }), 90);
    assert.equal(taskMinutes({}), 0);
    assert.equal(formatMinutes(90), "1h 30m");
    assert.equal(formatMinutes(45), "45m");
    assert.equal(formatMinutes(120), "2h");
    assert.equal(formatMinutes(0), "");
  });
});

describe("ordering", () => {
  it("places between neighbours", () => {
    assert.equal(positionBetween(undefined, undefined), 1000);
    assert.equal(positionBetween(undefined, 1000), 0);
    assert.equal(positionBetween(2000, undefined), 3000);
    assert.equal(positionBetween(1000, 2000), 1500);
  });
  it("writes only the moved task when the column is already ordered", () => {
    const col = [t({ id: "a", planOrder: 1000 }), t({ id: "b", planOrder: 2000 }), t({ id: "c", planOrder: 3000 })];
    assert.deepEqual(reorderWrites(col, "c", "a", false), [{ id: "c", planOrder: 0 }]);
    assert.deepEqual(reorderWrites(col, "a", "b", true), [{ id: "a", planOrder: 2500 }]);
  });
  it("writes nothing when the task lands where it was", () => {
    const col = [t({ id: "a", planOrder: 1000 }), t({ id: "b", planOrder: 2000 })];
    assert.deepEqual(reorderWrites(col, "a", "b", false), []);
    assert.deepEqual(reorderWrites(col, "b", "a", true), []);
    assert.deepEqual(reorderWrites(col, "a", "a", true), []);
  });
  it("seeds the whole column from screen order when some tasks have no order", () => {
    const col = [t({ id: "a" }), t({ id: "b" }), t({ id: "c" })];
    assert.deepEqual(reorderWrites(col, "c", "a", false), [
      { id: "c", planOrder: 1000 },
      { id: "a", planOrder: 2000 },
      { id: "b", planOrder: 3000 },
    ]);
  });
  it("skips seed writes for tasks that already hold the right value", () => {
    const col = [t({ id: "a", planOrder: 1000 }), t({ id: "b" })];
    assert.deepEqual(reorderWrites(col, "x", null, false), [
      { id: "b", planOrder: 2000 },
      { id: "x", planOrder: 3000 },
    ]);
  });
  it("inserts a task arriving from another day", () => {
    const col = [t({ id: "a", planOrder: 1000 }), t({ id: "b", planOrder: 2000 })];
    assert.deepEqual(reorderWrites(col, "x", "b", false), [{ id: "x", planOrder: 1500 }]);
    assert.deepEqual(reorderWrites(col, "x", null, false), [{ id: "x", planOrder: 3000 }]);
    assert.deepEqual(reorderWrites([], "x", null, false), [{ id: "x", planOrder: 1000 }]);
  });
});
