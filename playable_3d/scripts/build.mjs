import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = "src/main.js";
const modules = new Map();

function moduleId(fromId, request) {
  if (!request.startsWith(".")) throw new Error(`Only local imports are allowed: ${request}`);
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromId), request));
  return path.posix.extname(resolved) ? resolved : `${resolved}.js`;
}

function importSpecs(source) {
  const result = [];
  const matcher = /(?:import\s*(?:\*\s*as\s*[A-Za-z_$][\w$]*|\{[\s\S]*?\})\s*from|export\s*\{[^}]*\}\s*from)\s*["']([^"']+)["'];?/g;
  for (const match of source.matchAll(matcher)) result.push(match[1]);
  return result;
}

async function collect(id) {
  if (modules.has(id)) return;
  const filename = path.join(root, id);
  const source = await readFile(filename, "utf8");
  modules.set(id, source);
  for (const request of importSpecs(source)) await collect(moduleId(id, request));
}

function bindingParts(text) {
  return text.split(",").map((item) => item.trim()).filter(Boolean).map((item) => {
    const match = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(item);
    if (!match) throw new Error(`Unsupported module binding: ${item}`);
    return { imported: match[1], local: match[2] ?? match[1] };
  });
}

function transform(id, source) {
  let reexportIndex = 0;
  const declaredExports = [];

  source = source.replace(/export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["'];?/g, (_, bindings, request) => {
    const parts = bindingParts(bindings);
    const reference = `__reexport${reexportIndex++}`;
    const assignments = parts.map(({ imported, local }) => `${JSON.stringify(local)}:${reference}[${JSON.stringify(imported)}]`).join(",");
    return `const ${reference}=require(${JSON.stringify(moduleId(id, request))});Object.assign(exports,{${assignments}});`;
  });

  source = source.replace(/import\s*\*\s*as\s*([A-Za-z_$][\w$]*)\s*from\s*["']([^"']+)["'];?/g, (_, local, request) =>
    `const ${local}=require(${JSON.stringify(moduleId(id, request))});`);

  source = source.replace(/import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["'];?/g, (_, bindings, request) => {
    const parts = bindingParts(bindings);
    const destructure = parts.map(({ imported, local }) => imported === local ? imported : `${imported}:${local}`).join(",");
    return `const {${destructure}}=require(${JSON.stringify(moduleId(id, request))});`;
  });

  source = source.replace(/export\s+(const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g, (_, kind, name) => {
    declaredExports.push(name);
    return `${kind} ${name}`;
  }
  );

  source = source.replace(/export\s*\{([^}]*)\};?/g, (_, bindings) => {
    const assignments = bindingParts(bindings).map(({ imported, local }) => `${JSON.stringify(local)}:${imported}`).join(",");
    return `Object.assign(exports,{${assignments}});`;
  });

  if (declaredExports.length) {
    const assignments = [...new Set(declaredExports)].map((name) => `${JSON.stringify(name)}:${name}`).join(",");
    source += `\nObject.assign(exports,{${assignments}});`;
  }
  return source;
}

await collect(entry);
const definitions = [...modules].map(([id, source]) =>
  `${JSON.stringify(id)}:function(module,exports,require){\n${transform(id, source)}\n}`
).join(",\n");
const bundle = `/* AXM Theme Park v0.4.6 offline deterministic bundle */\n(function(){\n"use strict";\nconst modules={${definitions}};\nconst cache={};\nfunction require(id){if(cache[id])return cache[id].exports;const factory=modules[id];if(!factory)throw new Error("Missing bundled module: "+id);const module={exports:{}};cache[id]=module;factory(module,module.exports,require);return module.exports;}\nrequire(${JSON.stringify(entry)});\n})();\n`;
await writeFile("dist/game.js", bundle, "utf8");

await Promise.all([
  cp("src/index.html", "dist/index.html"),
  cp("src/styles.css", "dist/styles.css"),
  cp("README.md", "dist/README.txt")
]);

const bundleBytes = new TextEncoder().encode(bundle).byteLength;
console.log(`Built ${modules.size} local modules into playable_3d/dist/game.js (${bundleBytes} bytes).`);
