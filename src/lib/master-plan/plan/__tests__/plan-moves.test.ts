import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PlanTaskLike } from "../plan-days";
import {
  archive,
  canPlan,
  clearTime,
  moveToBacklog,
  moveToDay,
  planForDay,
  pushToNextDay,
  scheduleAt,
  toggleDone,
} from "../plan-moves";

const t = (p: Partial<PlanTaskLike> & { id: string }): PlanTaskLike => ({ title: p.id, status: "not_started", ...p });

describe("plan moves", () => {
  it("only lets whole cards be planned", () => {
    assert.equal(canPlan({ id: "card-1", sourceElementId: "card-1" }), true);
    assert.equal(canPlan({ id: "card-1-task-0", sourceElementId: "card-1" }), false);
  });

  it("moves a task into another day's column at a position", () => {
    const column = [t({ id: "a", plannedDate: "2026-10-20", planOrder: 1000 }), t({ id: "b", plannedDate: "2026-10-20", planOrder: 2000 })];
    const task = t({ id: "x", plannedDate: "2026-10-19", scheduledStart: "09:00" });
    assert.deepEqual(moveToDay(task, "2026-10-20", column, "b", false), [
      { id: "x", updates: { planOrder: 1500, plannedDate: "2026-10-20" } },
    ]);
  });

  it("moves a backlog task to the end of an empty day", () => {
    assert.deepEqual(moveToDay(t({ id: "x" }), "2026-10-20", [], null, false), [
      { id: "x", updates: { planOrder: 1000, plannedDate: "2026-10-20" } },
    ]);
  });

  it("reorders within a day without touching the date", () => {
    const column = [t({ id: "a", plannedDate: "d", planOrder: 1000 }), t({ id: "b", plannedDate: "d", planOrder: 2000 })];
    assert.deepEqual(moveToDay(column[1], "d", column, "a", false), [{ id: "b", updates: { planOrder: 0 } }]);
    assert.deepEqual(moveToDay(column[0], "d", column, "a", false), []);
  });

  it("seeds neighbours when the target day has unordered tasks", () => {
    const column = [t({ id: "a", plannedDate: "d" }), t({ id: "b", plannedDate: "d" })];
    assert.deepEqual(moveToDay(t({ id: "x" }), "d", column, "a", true), [
      { id: "a", updates: { planOrder: 1000 } },
      { id: "x", updates: { planOrder: 2000, plannedDate: "d" } },
      { id: "b", updates: { planOrder: 3000 } },
    ]);
  });

  it("sends a task back to the backlog without its day or time", () => {
    assert.deepEqual(moveToBacklog(t({ id: "x", plannedDate: "d", scheduledStart: "09:00" })), {
      id: "x",
      updates: { plannedDate: null, planOrder: null, scheduledStart: null },
    });
  });

  it("schedules on the clock, planning the day when needed", () => {
    assert.deepEqual(scheduleAt(t({ id: "x", plannedDate: "2026-10-20" }), "2026-10-20", 570, 45), {
      id: "x",
      updates: { scheduledStart: "09:30", durationMinutes: 45 },
    });
    assert.deepEqual(scheduleAt(t({ id: "x" }), "2026-10-20", 840, 60), {
      id: "x",
      updates: { scheduledStart: "14:00", durationMinutes: 60, plannedDate: "2026-10-20", planOrder: null },
    });
    assert.deepEqual(clearTime(t({ id: "x" })), { id: "x", updates: { scheduledStart: null } });
  });

  it("plans for a day, pushes to the next day, toggles done and archives", () => {
    assert.deepEqual(planForDay(t({ id: "x", plannedDate: "2026-10-19" }), "2026-10-19"), { id: "x", updates: {} });
    assert.deepEqual(planForDay(t({ id: "x" }), "2026-10-19").updates, { plannedDate: "2026-10-19", planOrder: null });
    assert.equal(pushToNextDay(t({ id: "x", plannedDate: "2026-10-22" }), "2026-10-19").updates.plannedDate, "2026-10-23");
    assert.equal(pushToNextDay(t({ id: "x", plannedDate: "2026-10-10" }), "2026-10-19").updates.plannedDate, "2026-10-20");
    assert.equal(pushToNextDay(t({ id: "x" }), "2026-10-19").updates.plannedDate, "2026-10-20");
    assert.equal(toggleDone(t({ id: "x" })).updates.status, "completed");
    assert.equal(toggleDone(t({ id: "x", status: "completed" })).updates.status, "not_started");
    assert.deepEqual(archive(t({ id: "x" })).updates, { isArchived: true });
  });
});
