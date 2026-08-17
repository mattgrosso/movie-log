import { describe, it, expect } from "vitest";
import { freshSnapshot, snapshotTime } from "../../scripts/snapshotFreshness.mjs";

// Guards the predeploy --skip-if-fresh throttle: with deploy-per-stopping-point,
// an unconditional pre-deploy backup was downloading the full database 36-56
// times a day in Aug 2026 (~$4-7/day of billed RTDB egress).

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-08-17T12:00:00Z");

describe("snapshotTime", () => {
  it("parses the filesystem-safe timestamp as UTC", () => {
    expect(snapshotTime("db-2026-08-17T13-44-45.json.gz")).toBe(Date.parse("2026-08-17T13:44:45Z"));
  });

  it("rejects non-snapshot filenames", () => {
    expect(snapshotTime("db-2026-08-17T13-44-45.json")).toBeNull();
    expect(snapshotTime("notes.txt")).toBeNull();
    expect(snapshotTime(".DS_Store")).toBeNull();
  });
});

describe("freshSnapshot", () => {
  it("returns the newest snapshot when it is within the window", () => {
    const files = [
      "db-2026-08-16T09-00-00.json.gz",
      "db-2026-08-17T11-30-00.json.gz",
      "db-2026-08-17T08-00-00.json.gz",
    ];
    expect(freshSnapshot(files, 6 * HOUR, NOW)).toBe("db-2026-08-17T11-30-00.json.gz");
  });

  it("returns null when even the newest snapshot is older than the window", () => {
    const files = ["db-2026-08-17T05-59-00.json.gz", "db-2026-08-16T09-00-00.json.gz"];
    expect(freshSnapshot(files, 6 * HOUR, NOW)).toBeNull();
  });

  it("treats a snapshot exactly at the window edge as fresh", () => {
    expect(freshSnapshot(["db-2026-08-17T06-00-00.json.gz"], 6 * HOUR, NOW)).toBe("db-2026-08-17T06-00-00.json.gz");
  });

  it("returns null for an empty or junk-only directory", () => {
    expect(freshSnapshot([], 6 * HOUR, NOW)).toBeNull();
    expect(freshSnapshot([".DS_Store", "restore-notes.md"], 6 * HOUR, NOW)).toBeNull();
  });

  it("ignores future-dated names instead of treating them as fresh", () => {
    // A clock-skewed future filename must not suppress a needed backup forever.
    expect(freshSnapshot(["db-2026-08-18T12-00-00.json.gz"], 6 * HOUR, NOW)).toBeNull();
  });
});
