import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { computeFileHash } from "../file-hash";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

let tempDir: string;

describe("computeFileHash", () => {
before(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "syncread-hash-"));
});

after(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

  it("produces the same hash for identical files", async () => {
    const fileA = join(tempDir, "a.txt");
    const fileB = join(tempDir, "b.txt");
    const contents = "synchronized content";

    await writeFile(fileA, contents);
    await writeFile(fileB, contents);

    const hashA = await computeFileHash(fileA);
    const hashB = await computeFileHash(fileB);

    assert.equal(hashA, hashB);
  });

  it("produces distinct hashes for different files", async () => {
    const fileA = join(tempDir, "c.txt");
    const fileB = join(tempDir, "d.txt");

    await writeFile(fileA, "alpha");
    await writeFile(fileB, "beta");

    const hashA = await computeFileHash(fileA);
    const hashB = await computeFileHash(fileB);

    assert.notEqual(hashA, hashB);
  });
});
