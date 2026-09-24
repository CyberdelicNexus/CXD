// Local JSON storage under lab-data/ (gitignored). Server-only.
// Writes are atomic (tmp + rename) and serialised per run, so a poll never
// reads a half-written file and a crash mid-write leaves the old file intact.
import fs, { type FileHandle } from "node:fs/promises";
import path from "node:path";
import { LAB_DATA_DIR } from "./config";
import type { Cell, LabInput, Run, RunSummary, Vote } from "./types";

const root = () => path.resolve(process.cwd(), LAB_DATA_DIR);
const runsDir = () => path.join(root(), "runs");
const votesFile = () => path.join(root(), "votes.jsonl");
const inputsFile = () => path.join(root(), "inputs.json");

async function ensureDirs(): Promise<void> {
  await fs.mkdir(runsDir(), { recursive: true });
}

let tmpSeq = 0;

async function writeAtomic(file: string, data: string): Promise<void> {
  const tmp = `${file}.${process.pid}.${Date.now()}.${tmpSeq++}.tmp`;
  await fs.writeFile(tmp, data, "utf8");
  // Windows can briefly refuse the rename while a reader holds the file open.
  // Never fall back to an in-place write: a crash mid-write would corrupt the file.
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await fs.rename(tmp, file);
      return;
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
  await fs.rm(tmp, { force: true });
  throw lastError;
}

const writeQueues = new Map<string, Promise<void>>();

export function saveRun(run: Run): Promise<void> {
  const data = JSON.stringify(run);
  const file = path.join(runsDir(), `${run.id}.json`);
  const prev = writeQueues.get(run.id) ?? Promise.resolve();
  const next = prev.then(async () => {
    await ensureDirs();
    await writeAtomic(file, data);
  }).catch((e) => console.error("[lab] saveRun failed", e));
  writeQueues.set(run.id, next);
  void next.then(() => { if (writeQueues.get(run.id) === next) writeQueues.delete(run.id); });
  return next;
}

export async function readRun(id: string): Promise<Run | null> {
  if (!/^[\w-]+$/.test(id)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(runsDir(), `${id}.json`), "utf8")) as Run;
  } catch {
    return null;
  }
}

export async function listRuns(): Promise<Run[]> {
  await ensureDirs();
  const files = (await fs.readdir(runsDir())).filter((f) => f.endsWith(".json"));
  const runs = await Promise.all(files.map((f) => readRun(f.replace(/\.json$/, ""))));
  return runs.filter((r): r is Run => r !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function summarise(run: Run): RunSummary {
  return {
    id: run.id, createdAt: run.createdAt, status: run.status,
    cellCount: run.cells.length, doneCount: run.cells.filter((c) => c.status === "done").length,
    spentUsd: run.spentUsd, estimateUsd: run.estimateUsd, config: run.config,
  };
}

export async function allCells(): Promise<Cell[]> {
  return (await listRuns()).flatMap((r) => r.cells);
}

/** True when the file exists, is non-empty and does not end in a newline (a torn append). */
async function endsMidLine(file: string): Promise<boolean> {
  let fh: FileHandle | undefined;
  try {
    fh = await fs.open(file, "r");
    const { size } = await fh.stat();
    if (size === 0) return false;
    const buf = Buffer.alloc(1);
    await fh.read(buf, 0, 1, size - 1);
    return buf[0] !== 0x0a;
  } catch {
    return false;
  } finally {
    await fh?.close();
  }
}

export async function appendVote(vote: Vote): Promise<void> {
  await ensureDirs();
  // After a crash mid-append, start on a fresh line so this vote is not glued to the fragment.
  const lead = (await endsMidLine(votesFile())) ? "\n" : "";
  await fs.appendFile(votesFile(), lead + JSON.stringify(vote) + "\n", "utf8");
}

export async function readVotes(): Promise<Vote[]> {
  let text: string;
  try {
    text = await fs.readFile(votesFile(), "utf8");
  } catch {
    return [];
  }
  // Parse line by line: one torn line (crash mid-append) must not lose every vote.
  const votes: Vote[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      votes.push(JSON.parse(line) as Vote);
    } catch {
      console.warn("[lab] skipping unreadable vote line");
    }
  }
  return votes;
}

export async function readCustomInputs(): Promise<LabInput[]> {
  try {
    return JSON.parse(await fs.readFile(inputsFile(), "utf8")) as LabInput[];
  } catch {
    return [];
  }
}

export async function saveCustomInput(input: LabInput): Promise<void> {
  await ensureDirs();
  const existing = await readCustomInputs();
  await writeAtomic(inputsFile(), JSON.stringify([...existing.filter((i) => i.id !== input.id), input], null, 2));
}
