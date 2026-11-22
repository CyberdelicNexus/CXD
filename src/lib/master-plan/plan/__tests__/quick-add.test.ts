import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseQuickAdd } from "../quick-add";

describe("quick add", () => {
  it("keeps plain titles as typed", () => {
    assert.deepEqual(parseQuickAdd("  Write the brief  "), { title: "Write the brief" });
  });
  it("reads a trailing duration", () => {
    assert.deepEqual(parseQuickAdd("Draft brief 45m"), { title: "Draft brief", durationMinutes: 45 });
    assert.deepEqual(parseQuickAdd("Review 1h30"), { title: "Review", durationMinutes: 90 });
    assert.deepEqual(parseQuickAdd("Review 2h"), { title: "Review", durationMinutes: 120 });
  });
  it("does not read the first word as a duration", () => {
    assert.deepEqual(parseQuickAdd("2h review"), { title: "2h review" });
  });
  it("reads @ times in 24h and am/pm", () => {
    assert.deepEqual(parseQuickAdd("Call studio @14:30"), { title: "Call studio", scheduledStart: "14:30" });
    assert.deepEqual(parseQuickAdd("Review @2pm 1h30"), { title: "Review", scheduledStart: "14:00", durationMinutes: 90 });
    assert.deepEqual(parseQuickAdd("Standup @12am"), { title: "Standup", scheduledStart: "00:00" });
  });
  it("reads @ ranges", () => {
    assert.deepEqual(parseQuickAdd("Sync @9-10:30"), { title: "Sync", scheduledStart: "09:00", durationMinutes: 90 });
    assert.deepEqual(parseQuickAdd("Show @10-11pm"), { title: "Show", scheduledStart: "22:00", durationMinutes: 60 });
  });
  it("leaves things that only look like tokens in the title", () => {
    assert.deepEqual(parseQuickAdd("Email jo@studio.com"), { title: "Email jo@studio.com" });
    assert.deepEqual(parseQuickAdd("Meet @lunch"), { title: "Meet @lunch" });
    assert.deepEqual(parseQuickAdd("Fix @25:00"), { title: "Fix @25:00" });
  });
});
