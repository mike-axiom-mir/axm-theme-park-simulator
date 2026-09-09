import fs from "node:fs";
import { fileURLToPath } from "node:url";

const packagePath = fileURLToPath(new URL("../package.json", import.meta.url));

export function describeCapability() {
  const packageDocument = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const capability = packageDocument.axmCapability;
  if (!capability || capability.schema !== "axm.capability/v1") {
    throw new Error(`Package capability metadata is missing or incompatible: ${packagePath}`);
  }
  return structuredClone(capability);
}
