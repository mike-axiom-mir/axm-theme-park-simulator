export const MAX_JSON_DEPTH = 256;

function jsonAdmissionError(code, message, details = {}) {
  const error = new SyntaxError(message, details.cause === undefined ? undefined : { cause: details.cause });
  error.code = code;
  if (details.memberName !== undefined) error.memberName = details.memberName;
  return error;
}

function assertUniqueObjectKeys(text, maxDepth) {
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
  }

  function scanValue(depth) {
    if (depth > maxDepth) {
      throw jsonAdmissionError(
        "AXM_JSON_TOO_DEEP",
        `JSON nesting exceeds ${maxDepth} levels.`
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
        throw jsonAdmissionError(
          "AXM_JSON_DUPLICATE_KEY",
          `JSON contains duplicate decoded member name: ${JSON.stringify(key)}`,
          { memberName: key }
        );
      }
      seen.add(key);

      skipWhitespace();
      index += 1;
      scanValue(depth);
      skipWhitespace();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      index += 1;
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
      index += 1;
    }
  }

  scanValue(0);
}

export function parseUnambiguousJson(text, { maxDepth = MAX_JSON_DEPTH } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw jsonAdmissionError("AXM_JSON_INVALID", "Input is not valid JSON.", { cause });
  }
  assertUniqueObjectKeys(text, maxDepth);
  return parsed;
}
