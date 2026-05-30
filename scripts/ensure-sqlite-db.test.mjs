import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureSqliteDatabaseFile,
  resolveSqliteFilePath
} from "./ensure-sqlite-db.mjs";

const tempDirs = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    )
  );
});

async function makeTempProject() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sms-platform-"));
  tempDirs.push(directory);
  return {
    directory,
    schemaPath: path.join(directory, "prisma", "schema.prisma")
  };
}

describe("ensure sqlite database file", () => {
  it("resolves relative SQLite URLs from the Prisma schema directory", async () => {
    const { directory, schemaPath } = await makeTempProject();

    expect(resolveSqliteFilePath("file:./test.db", schemaPath)).toBe(
      path.join(directory, "prisma", "test.db")
    );
    expect(
      resolveSqliteFilePath("file:../shared/test.db?connection_limit=1", schemaPath)
    ).toBe(path.join(directory, "shared", "test.db"));
  });

  it("creates a missing SQLite database file before Prisma db push runs", async () => {
    const { directory, schemaPath } = await makeTempProject();
    const databasePath = path.join(directory, "prisma", "nested", "test.db");

    await expect(access(databasePath)).rejects.toMatchObject({ code: "ENOENT" });

    await expect(
      ensureSqliteDatabaseFile({
        databaseUrl: "file:./nested/test.db",
        schemaPath
      })
    ).resolves.toBe(databasePath);
    await expect(access(databasePath)).resolves.toBeUndefined();
  });

  it("skips non-file and in-memory database URLs", () => {
    expect(resolveSqliteFilePath("postgresql://localhost/app")).toBeNull();
    expect(resolveSqliteFilePath("file::memory:")).toBeNull();
  });
});
