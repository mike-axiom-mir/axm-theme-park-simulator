import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const MAX_SAVE_BYTES = 64 * 1024 * 1024;

export function readSave(filePath) {
  const resolved = path.resolve(filePath);
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) throw new Error(`Save path is not a file: ${resolved}`);
  if (stat.size > MAX_SAVE_BYTES) {
    throw new Error(`Save exceeds ${MAX_SAVE_BYTES} bytes: ${resolved}`);
  }
  return fs.readFileSync(resolved, "utf8");
}

function ownTempPath(resolved) {
  const directory = path.dirname(resolved);
  const base = path.basename(resolved);
  return path.join(directory, `.${base}.axm-save-${process.pid}-${randomUUID()}.tmp`);
}

function removeOwnTemp(tempPath) {
  try {
    fs.unlinkSync(tempPath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      // Cleanup cannot make a complete, already-published hard link partial.
      // Keep publication semantics unambiguous rather than reporting the save
      // as failed after its create-only destination link already exists.
    }
  }
}

export function writeNewSave(filePath, text) {
  const resolved = path.resolve(filePath);
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > MAX_SAVE_BYTES) throw new Error(`Save exceeds ${MAX_SAVE_BYTES} bytes.`);

  const directory = path.dirname(resolved);
  fs.mkdirSync(directory, { recursive: true });

  const tempPath = ownTempPath(resolved);
  let tempFd;
  try {
    tempFd = fs.openSync(tempPath, "wx", 0o600);
    fs.writeFileSync(tempFd, text, { encoding: "utf8" });
    fs.fsyncSync(tempFd);
    fs.closeSync(tempFd);
    tempFd = undefined;

    // A hard link creates the final name atomically without overwrite. The
    // destination appears only after the sibling temp contains complete,
    // fsync'd bytes. EEXIST and unsupported-link failures leave the existing
    // destination untouched and fail closed.
    fs.linkSync(tempPath, resolved);
    return resolved;
  } finally {
    if (tempFd !== undefined) {
      try {
        fs.closeSync(tempFd);
      } catch {
        // Preserve the primary write/open error; cleanup remains best effort.
      }
    }
    removeOwnTemp(tempPath);
  }
}
