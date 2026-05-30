import { constants } from "node:fs";
import { access, mkdir, open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function isMemoryDatabase(filePath) {
  return filePath === ":memory:" || filePath === "memory";
}

export function resolveSqliteFilePath(
  databaseUrl = process.env.DATABASE_URL,
  schemaPath = path.join(process.cwd(), "prisma", "schema.prisma")
) {
  if (!databaseUrl?.startsWith("file:")) {
    return null;
  }

  const rawFilePath = databaseUrl.slice("file:".length).split("?")[0];

  if (!rawFilePath || isMemoryDatabase(rawFilePath)) {
    return null;
  }

  if (path.isAbsolute(rawFilePath)) {
    return rawFilePath;
  }

  return path.resolve(path.dirname(schemaPath), rawFilePath);
}

export async function ensureSqliteDatabaseFile({
  databaseUrl = process.env.DATABASE_URL,
  schemaPath = path.join(process.cwd(), "prisma", "schema.prisma")
} = {}) {
  const databasePath = resolveSqliteFilePath(databaseUrl, schemaPath);

  if (!databasePath) {
    return null;
  }

  try {
    await access(databasePath, constants.F_OK);
    return databasePath;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  await mkdir(path.dirname(databasePath), { recursive: true });
  const handle = await open(databasePath, "a");
  await handle.close();

  return databasePath;
}

function isMainModule() {
  return process.argv[1]
    ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
    : false;
}

if (isMainModule()) {
  try {
    await ensureSqliteDatabaseFile();
  } catch (error) {
    console.error(
      `Failed to prepare SQLite database file: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    process.exitCode = 1;
  }
}
