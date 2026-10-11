-- Canvas Assistant feedback: allow the 'removed' event (a build taken back off
-- the canvas within minutes, by undo or delete).
--
-- The table's own migration (20261011000002) now lists it, but a database
-- where that migration was applied before this event existed still has the
-- narrower CHECK. This brings both cases to the same constraint and is safe to
-- run either way.

ALTER TABLE canvas_assistant_feedback
  DROP CONSTRAINT IF EXISTS canvas_assistant_feedback_event_check;

ALTER TABLE canvas_assistant_feedback
  ADD CONSTRAINT canvas_assistant_feedback_event_check
  CHECK (event IN ('form_picked', 'built', 'discarded', 'refined', 'rated', 'removed'));
