/**
 * scripts/sync-shared.ts
 *
 * Keeps supabase/functions/_shared/bot-registry.ts (Deno) in sync with
 * shared/bot-registry.ts (Node/Edge source of truth). The file is pure TS
 * with no Node-specific syntax, so a straight copy is sufficient for Deno
 * imports.
 *
 * Usage:
 *   tsx scripts/sync-shared.ts --write   # copy source -> synced destination
 *   tsx scripts/sync-shared.ts --check   # exit non-zero if they differ
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const SOURCE = join(repoRoot, "shared", "bot-registry.ts");
const DEST = join(repoRoot, "supabase", "functions", "_shared", "bot-registry.ts");

const HEADER = `// AUTO-GENERATED — do not edit directly.
// Synced from shared/bot-registry.ts via \`npm run sync:shared\`.
// Run \`npm run check:shared\` to verify this file is not stale.

`;

function buildOutput(): string {
  const source = readFileSync(SOURCE, "utf8");
  return HEADER + source;
}

function main() {
  const mode = process.argv.includes("--check")
    ? "check"
    : process.argv.includes("--write")
      ? "write"
      : null;

  if (!mode) {
    console.error("Usage: tsx scripts/sync-shared.ts --write | --check");
    process.exit(2);
  }

  const desired = buildOutput();

  if (mode === "write") {
    mkdirSync(dirname(DEST), { recursive: true });
    writeFileSync(DEST, desired, "utf8");
    console.log(`Synced ${SOURCE} -> ${DEST}`);
    return;
  }

  // --check
  if (!existsSync(DEST)) {
    console.error(
      `${DEST} does not exist. Run \`npm run sync:shared\` to generate it.`,
    );
    process.exit(1);
  }
  const actual = readFileSync(DEST, "utf8");
  if (actual !== desired) {
    console.error(
      `${DEST} is out of sync with ${SOURCE}. Run \`npm run sync:shared\` to fix.`,
    );
    process.exit(1);
  }
  console.log("shared/bot-registry.ts and its synced copy match.");
}

main();
