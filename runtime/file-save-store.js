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

export function writeNewSave(filePath, text) {
  const resolved = path.resolve(filePath);
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > MAX_SAVE_BYTES) throw new Error(`Save exceeds ${MAX_SAVE_BYTES} bytes.`);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, text, { encoding: "utf8", flag: "wx" });
  return resolved;
}
