import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";
import { parseUnambiguousJson } from "../playable_3d/src/core/strict-json.js";

export const MAX_ACTION_BYTES = 1024 * 1024;
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

function parseActionJson(text, resolved) {
  try {
    return parseUnambiguousJson(text);
  } catch (error) {
    if (error?.code === "AXM_JSON_INVALID") {
      throw actionReadError("AXM_ACTION_INVALID_JSON", `Action file is not valid JSON: ${resolved}`, error);
    }
    if (error?.code === "AXM_JSON_DUPLICATE_KEY") {
      throw actionReadError(
        "AXM_ACTION_DUPLICATE_KEY",
        `Action JSON contains duplicate decoded member name: ${JSON.stringify(error.memberName)}`,
        error
      );
    }
    if (error?.code === "AXM_JSON_TOO_DEEP") {
      throw actionReadError(
        "AXM_ACTION_JSON_TOO_DEEP",
        "Action JSON nesting exceeds 256 levels.",
        error
      );
    }
    throw error;
  }
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
