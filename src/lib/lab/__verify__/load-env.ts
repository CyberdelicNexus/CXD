import fs from "node:fs";
import path from "node:path";

/** Load .env.local into process.env (Next does this for the server; scripts must do it themselves). */
export function loadEnvLocal(): void {
  const file = path.resolve(process.cwd(), ".env.local");
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
