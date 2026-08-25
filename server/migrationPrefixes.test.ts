import { readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = path.resolve(import.meta.dirname, "..", "drizzle");

describe("Drizzle migration naming", () => {
  it("never permits two SQL migration files to share a numeric prefix", async () => {
    const filenames = (await readdir(migrationsDirectory))
      .filter((filename) => /^\d+_.+\.sql$/.test(filename))
      .sort();

    const byPrefix = new Map<string, string[]>();
    for (const filename of filenames) {
      const prefix = filename.match(/^(\d+)_/)?.[1];
      if (!prefix) continue;
      byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), filename]);
    }

    const collisions = [...byPrefix.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([prefix, files]) => `${prefix}: ${files.join(", ")}`);

    expect(collisions, `Duplicate migration prefixes found:\n${collisions.join("\n")}`).toEqual([]);
  });
});
