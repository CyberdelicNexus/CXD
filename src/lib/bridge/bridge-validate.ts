/**
 * Body validation for POST /api/bridge/task-writeback (PS2_CANVAS_BRIDGE.md B3,
 * C2_CANVAS_BRIDGE.md §1 Direction 2 / §4).
 *
 * Phase B accepts EXACTLY:
 *   { idempotencyKey: uuid, projectId: uuid, elementId: string,
 *     taskKey: string|null, patch: { status?: TaskStatus, dueDate?: ISO date } }
 *
 * Any unknown top-level key, any unknown patch key, or an invalid value for
 * a known key is a 422 — never silently dropped or coerced. This is the
 * server-side allowlist that keeps a compromised LifeOS box from pushing
 * arbitrary structure into the Y.Doc (B3).
 *
 * Pure functions — no I/O, no env reads — so they're trivially unit
 * testable whenever a test runner is added to this repo (none exists today;
 * see the bridge PR notes).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Matches the synthetic sub-checkbox task id shape from C1 §1 / task-engine.ts:
// `${element.id}-task-${index}` → the bridge-facing taskKey is just `task-${index}`.
const TASK_KEY_RE = /^task-\d+$/;

// Accepts a date-only ISO string or a full ISO datetime (optional ms, optional
// Z/offset). Followed by a real Date.parse() sanity check (rejects e.g. 2024-13-45).
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?)?$/;

const STATUS_VALUES = ['not_started', 'in_progress', 'completed', 'blocked'] as const;
export type BridgeTaskStatus = (typeof STATUS_VALUES)[number];

const MAX_ELEMENT_ID_LEN = 200;

export interface WritebackPatch {
  status?: BridgeTaskStatus;
  dueDate?: string;
}

export interface WritebackBody {
  idempotencyKey: string;
  projectId: string;
  elementId: string;
  taskKey: string | null;
  patch: WritebackPatch;
}

export type WritebackValidation =
  | { ok: true; value: WritebackBody }
  | { ok: false; error: string };

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

export function isValidTaskKey(value: unknown): value is string {
  return typeof value === 'string' && TASK_KEY_RE.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const TOP_LEVEL_KEYS = new Set(['idempotencyKey', 'projectId', 'elementId', 'taskKey', 'patch']);
const PATCH_KEYS = new Set(['status', 'dueDate']);

/**
 * Validate a parsed JSON body against the Phase B write-back contract.
 * Returns the narrowed, typed body on success or a human-readable reason
 * on the first validation failure encountered.
 */
export function validateWritebackBody(raw: unknown): WritebackValidation {
  if (!isPlainObject(raw)) {
    return { ok: false, error: 'Body must be a JSON object' };
  }

  const unknownTopLevel = Object.keys(raw).filter((k) => !TOP_LEVEL_KEYS.has(k));
  if (unknownTopLevel.length > 0) {
    return { ok: false, error: `Unknown field(s): ${unknownTopLevel.join(', ')}` };
  }

  if (!isValidUuid(raw.idempotencyKey)) {
    return { ok: false, error: 'idempotencyKey must be a uuid' };
  }
  if (!isValidUuid(raw.projectId)) {
    return { ok: false, error: 'projectId must be a uuid' };
  }
  if (typeof raw.elementId !== 'string' || raw.elementId.length === 0 || raw.elementId.length > MAX_ELEMENT_ID_LEN) {
    return { ok: false, error: 'elementId must be a non-empty string' };
  }

  // taskKey: required key, but nullable. Treat an omitted key the same as
  // an explicit null (defensive — the documented shape requires the key,
  // but tolerating omission costs nothing and avoids brittle client coupling).
  const taskKeyRaw = 'taskKey' in raw ? raw.taskKey : null;
  if (taskKeyRaw !== null && !isValidTaskKey(taskKeyRaw)) {
    return { ok: false, error: 'taskKey must be null or match "task-<index>"' };
  }
  const taskKey: string | null = taskKeyRaw === null ? null : taskKeyRaw;

  if (!isPlainObject(raw.patch)) {
    return { ok: false, error: 'patch must be a JSON object' };
  }
  const unknownPatchKeys = Object.keys(raw.patch).filter((k) => !PATCH_KEYS.has(k));
  if (unknownPatchKeys.length > 0) {
    return { ok: false, error: `Unknown patch field(s): ${unknownPatchKeys.join(', ')}` };
  }

  const patch: WritebackPatch = {};

  if ('status' in raw.patch) {
    const status = raw.patch.status;
    if (typeof status !== 'string' || !STATUS_VALUES.includes(status as BridgeTaskStatus)) {
      return { ok: false, error: `patch.status must be one of: ${STATUS_VALUES.join(', ')}` };
    }
    patch.status = status as BridgeTaskStatus;
  }

  if ('dueDate' in raw.patch) {
    const dueDate = raw.patch.dueDate;
    if (!isValidIsoDate(dueDate)) {
      return { ok: false, error: 'patch.dueDate must be a valid ISO date string' };
    }
    // A sub-checkbox line (taskKey set) has no per-line due-date field on the
    // canvas — only the parent element's taskMetadata.dueDate exists, and a
    // taskKey write targets the markdown line, not taskMetadata. Reject
    // rather than silently no-op.
    if (taskKey !== null) {
      return { ok: false, error: 'patch.dueDate is not applicable when taskKey is set (sub-checkbox tasks only support status)' };
    }
    patch.dueDate = dueDate;
  }

  if (patch.status === undefined && patch.dueDate === undefined) {
    return { ok: false, error: 'patch must include at least one of: status, dueDate' };
  }

  return {
    ok: true,
    value: {
      idempotencyKey: raw.idempotencyKey,
      projectId: raw.projectId,
      elementId: raw.elementId,
      taskKey,
      patch,
    },
  };
}
