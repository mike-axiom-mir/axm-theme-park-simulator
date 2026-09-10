import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

export const MAX_SAVE_BYTES = 64 * 1024 * 1024;

function saveReadError(code, message, cause) {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.code = code;
  return error;
}

function sameOpenedFile(admitted, opened) {
  return admitted.dev === opened.dev && admitted.ino === opened.ino;
}

function sameObservedFile(opened, afterRead) {
  return (
    opened.dev === afterRead.dev &&
    opened.ino === afterRead.ino &&
    opened.size === afterRead.size &&
    opened.mtimeNs === afterRead.mtimeNs &&
    opened.ctimeNs === afterRead.ctimeNs
  );
}

export function readSave(filePath) {
  const resolved = path.resolve(filePath);
  const admitted = fs.lstatSync(resolved, { bigint: true });
  if (admitted.isSymbolicLink()) {
    throw saveReadError("AXM_SAVE_PATH_SYMLINK", `Save path must not be a symbolic link: ${resolved}`);
  }
  if (!admitted.isFile()) {
    throw saveReadError("AXM_SAVE_NOT_REGULAR_FILE", `Save path is not a regular file: ${resolved}`);
  }
  if (admitted.size > BigInt(MAX_SAVE_BYTES)) {
    throw saveReadError("AXM_SAVE_TOO_LARGE", `Save exceeds ${MAX_SAVE_BYTES} bytes: ${resolved}`);
  }

  const noFollow = fs.constants.O_NOFOLLOW ?? 0;
  let fd;
  try {
    try {
      fd = fs.openSync(resolved, fs.constants.O_RDONLY | noFollow);
    } catch (error) {
      if (noFollow !== 0 && error?.code === "ELOOP") {
        throw saveReadError(
          "AXM_SAVE_PATH_CHANGED",
          `Save path changed between admission and open: ${resolved}`,
          error
        );
      }
      throw error;
    }

    const opened = fs.fstatSync(fd, { bigint: true });
    if (!opened.isFile() || !sameOpenedFile(admitted, opened)) {
      throw saveReadError(
        "AXM_SAVE_PATH_CHANGED",
        `Save path changed between admission and open: ${resolved}`
      );
    }
    if (opened.size > BigInt(MAX_SAVE_BYTES)) {
      throw saveReadError("AXM_SAVE_TOO_LARGE", `Save exceeds ${MAX_SAVE_BYTES} bytes: ${resolved}`);
    }

    const admittedBytes = Number(opened.size);
    const buffer = Buffer.alloc(admittedBytes + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const read = fs.readSync(fd, buffer, offset, buffer.length - offset, null);
      if (read === 0) break;
      offset += read;
    }

    const afterRead = fs.fstatSync(fd, { bigint: true });
    if (offset > MAX_SAVE_BYTES) {
      throw saveReadError("AXM_SAVE_TOO_LARGE", `Save grew beyond ${MAX_SAVE_BYTES} bytes while reading: ${resolved}`);
    }
    if (offset !== admittedBytes || !sameObservedFile(opened, afterRead)) {
      throw saveReadError(
        "AXM_SAVE_CHANGED_DURING_READ",
        `Save changed while its bytes were being read: ${resolved}`
      );
    }

    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, offset));
    } catch (error) {
      throw saveReadError("AXM_SAVE_INVALID_UTF8", `Save is not valid UTF-8: ${resolved}`, error);
    }
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
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
