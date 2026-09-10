import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

export const MAX_ACTION_BYTES = 1024 * 1024;
const MAX_JSON_DEPTH = 256;

function actionReadError(code, message, cause) {
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

function assertUniqueObjectKeys(text) {
  let index = 0;

  function skipWhitespace() {
    while (index < text.length && /\s/.test(text[index])) index += 1;
  }

  function readString() {
    const start = index;
    index += 1;
    while (index < text.length) {
      if (text[index] === "\\") {
        index += 2;
        continue;
      }
      if (text[index] === '"') {
        index += 1;
        return JSON.parse(text.slice(start, index));
      }
      index += 1;
    }
    throw actionReadError("AXM_ACTION_INVALID_JSON", "Action JSON string did not terminate.");
  }

  function scanValue(depth) {
    if (depth > MAX_JSON_DEPTH) {
      throw actionReadError(
        "AXM_ACTION_JSON_TOO_DEEP",
        `Action JSON nesting exceeds ${MAX_JSON_DEPTH} levels.`
      );
    }

    skipWhitespace();
    const token = text[index];
    if (token === "{") {
      scanObject(depth + 1);
      return;
    }
    if (token === "[") {
      scanArray(depth + 1);
      return;
    }
    if (token === '"') {
      readString();
      return;
    }

    while (index < text.length && !/[\s,}\]]/.test(text[index])) index += 1;
  }

  function scanObject(depth) {
    index += 1;
    skipWhitespace();
    if (text[index] === "}") {
      index += 1;
      return;
    }

    const seen = new Set();
    while (index < text.length) {
      skipWhitespace();
      const key = readString();
      if (seen.has(key)) {
        throw actionReadError(
          "AXM_ACTION_DUPLICATE_KEY",
          `Action JSON contains duplicate decoded member name: ${JSON.stringify(key)}`
        );
      }
      seen.add(key);

      skipWhitespace();
      index += 1; // Native JSON.parse already proved this byte is ':'.
      scanValue(depth);
      skipWhitespace();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      index += 1; // Native JSON.parse already proved this byte is ','.
    }
  }

  function scanArray(depth) {
    index += 1;
    skipWhitespace();
    if (text[index] === "]") {
      index += 1;
      return;
    }

    while (index < text.length) {
      scanValue(depth);
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      index += 1; // Native JSON.parse already proved this byte is ','.
    }
  }

  scanValue(0);
}

function parseActionJson(text, resolved) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw actionReadError("AXM_ACTION_INVALID_JSON", `Action file is not valid JSON: ${resolved}`, error);
  }
  assertUniqueObjectKeys(text);
  return parsed;
}

export function readActionFile(filePath) {
  const resolved = path.resolve(filePath);
  const admitted = fs.lstatSync(resolved, { bigint: true });
  if (admitted.isSymbolicLink()) {
    throw actionReadError("AXM_ACTION_PATH_SYMLINK", `Action path must not be a symbolic link: ${resolved}`);
  }
  if (!admitted.isFile()) {
    throw actionReadError("AXM_ACTION_NOT_REGULAR_FILE", `Action path is not a regular file: ${resolved}`);
  }
  if (admitted.size > BigInt(MAX_ACTION_BYTES)) {
    throw actionReadError("AXM_ACTION_TOO_LARGE", `Action exceeds ${MAX_ACTION_BYTES} bytes: ${resolved}`);
  }

  const noFollow = fs.constants.O_NOFOLLOW ?? 0;
  let fd;
  try {
    try {
      fd = fs.openSync(resolved, fs.constants.O_RDONLY | noFollow);
    } catch (error) {
      if (noFollow !== 0 && error?.code === "ELOOP") {
        throw actionReadError(
          "AXM_ACTION_PATH_CHANGED",
          `Action path changed between admission and open: ${resolved}`,
          error
        );
      }
      throw error;
    }

    const opened = fs.fstatSync(fd, { bigint: true });
    if (!opened.isFile() || !sameOpenedFile(admitted, opened)) {
      throw actionReadError(
        "AXM_ACTION_PATH_CHANGED",
        `Action path changed between admission and open: ${resolved}`
      );
    }
    if (opened.size > BigInt(MAX_ACTION_BYTES)) {
      throw actionReadError("AXM_ACTION_TOO_LARGE", `Action exceeds ${MAX_ACTION_BYTES} bytes: ${resolved}`);
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
    if (offset > MAX_ACTION_BYTES) {
      throw actionReadError(
        "AXM_ACTION_TOO_LARGE",
        `Action grew beyond ${MAX_ACTION_BYTES} bytes while reading: ${resolved}`
      );
    }
    if (offset !== admittedBytes || !sameObservedFile(opened, afterRead)) {
      throw actionReadError(
        "AXM_ACTION_CHANGED_DURING_READ",
        `Action changed while its bytes were being read: ${resolved}`
      );
    }

    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, offset));
    } catch (error) {
      throw actionReadError("AXM_ACTION_INVALID_UTF8", `Action is not valid UTF-8: ${resolved}`, error);
    }
    return parseActionJson(text, resolved);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
