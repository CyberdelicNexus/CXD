import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTaskMetadataPatch, validatePlanFields } from "./task-metadata-patch";

describe("task metadata patch", () => {
  it("splits sets from clears", () => {
    const r = buildTaskMetadataPatch({ plannedDate: "2026-10-20", scheduledStart: null, durationMinutes: null, dueDate: null });
    assert.deepEqual(r.set, { plannedDate: "2026-10-20" });
    assert.deepEqual([...r.clear].sort(), ["dueDate", "durationMinutes", "scheduledStart"]);
  });
  it("renames tags to customTags and clears an emptied description", () => {
    const r = buildTaskMetadataPatch({ tags: ["a"], description: "" });
    assert.deepEqual(r.set, { customTags: ["a"] });
    assert.deepEqual(r.clear, ["description"]);
  });
  it("ignores element-level fields", () => {
    assert.deepEqual(buildTaskMetadataPatch({ title: "x", hypercubeTags: [] }), { set: {}, clear: [] });
  });
  it("validates plan fields", () => {
    assert.equal(validatePlanFields({ plannedDate: "2026-10-20", scheduledStart: "09:15", durationMinutes: 45, planOrder: 1500 }), null);
    assert.equal(validatePlanFields({ plannedDate: null, scheduledStart: null, durationMinutes: null, planOrder: null }), null);
    assert.match(validatePlanFields({ plannedDate: "2026-02-30" }) ?? "", /plannedDate/);
    assert.match(validatePlanFields({ plannedDate: "20-10-2026" }) ?? "", /plannedDate/);
    assert.match(validatePlanFields({ scheduledStart: "9:15" }) ?? "", /scheduledStart/);
    assert.match(validatePlanFields({ scheduledStart: "24:00" }) ?? "", /scheduledStart/);
    assert.match(validatePlanFields({ durationMinutes: 2 }) ?? "", /durationMinutes/);
    assert.match(validatePlanFields({ durationMinutes: 30.5 }) ?? "", /durationMinutes/);
    assert.match(validatePlanFields({ planOrder: Infinity }) ?? "", /planOrder/);
  });
});
