function fixInvalidJsonEscapes(json: string): string {
  return json.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
}

function collectJsonCandidates(text: string): string[] {
  const candidates = new Set<string>();
  const trimmed = text.trim();
  if (trimmed) candidates.add(trimmed);

  const closedBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (closedBlock?.[1]) candidates.add(closedBlock[1].trim());

  const openBlock = trimmed.match(/```(?:json)?\s*([\s\S]+)/i);
  if (openBlock?.[1]) {
    candidates.add(openBlock[1].replace(/```\s*$/, "").trim());
  }

  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start !== -1 && end > start) {
    candidates.add(trimmed.slice(start, end + 1));
  } else if (start !== -1) {
    candidates.add(trimmed.slice(start));
  }

  return [...candidates];
}

function salvageTruncatedObject(text: string, objStart: number): any | null {
  let fragment = text.slice(objStart).trimEnd();
  if (!fragment.startsWith("{")) return null;

  const quoteCount = (fragment.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 === 1) {
    fragment += '"';
  }
  fragment = fragment.replace(/,\s*"[^"]*":\s*[^,}\]]*$/, "");
  fragment = fragment.replace(/,\s*$/, "");
  if (!fragment.endsWith("}")) {
    fragment += "}";
  }

  for (const attempt of [fragment, fixInvalidJsonEscapes(fragment)]) {
    try {
      const obj = JSON.parse(attempt);
      if (obj && typeof obj.question === "string" && obj.question.trim()) {
        return obj;
      }
    } catch {
      // try next attempt
    }
  }
  return null;
}

function salvageJsonObjects(text: string): any[] {
  const results: any[] = [];
  const start = text.indexOf("[");
  if (start === -1) return results;

  let i = start + 1;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i]!)) i++;
    if (i >= text.length || text[i] === "]") break;
    if (text[i] !== "{") {
      i++;
      continue;
    }

    const objStart = i;
    let depth = 0;
    let inString = false;
    let escape = false;

    for (; i < text.length; i++) {
      const ch = text[i]!;
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\" && inString) {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === "{") depth++;
        if (ch === "}") {
          depth--;
          if (depth === 0) {
            const objText = text.slice(objStart, i + 1);
            for (const attempt of [objText, fixInvalidJsonEscapes(objText)]) {
              try {
                const obj = JSON.parse(attempt);
                if (obj && typeof obj.question === "string" && obj.question.trim()) {
                  results.push(obj);
                  break;
                }
              } catch {
                // try next attempt
              }
            }
            i++;
            break;
          }
        }
      }
    }

    if (depth > 0) {
      const salvaged = salvageTruncatedObject(text, objStart);
      if (salvaged) {
        const key = salvaged.question.trim();
        if (!results.some((r) => r.question?.trim() === key)) {
          results.push(salvaged);
        }
      }
    }
  }

  const lastBrace = text.lastIndexOf("{");
  if (lastBrace > start) {
    const trailing = salvageTruncatedObject(text, lastBrace);
    if (trailing) {
      const key = trailing.question.trim();
      if (!results.some((r) => r.question?.trim() === key)) {
        results.push(trailing);
      }
    }
  }

  return results;
}

function tryParseJsonArray(jsonText: string): any[] | null {
  const attempts = [jsonText, fixInvalidJsonEscapes(jsonText)];

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // try next attempt
    }
  }

  const salvaged = salvageJsonObjects(jsonText);
  return salvaged.length > 0 ? salvaged : null;
}

export function extractJsonArray(text: string): string {
  const candidates = collectJsonCandidates(text);
  for (const candidate of candidates) {
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }

  for (const candidate of candidates) {
    const fixed = fixInvalidJsonEscapes(candidate);
    try {
      JSON.parse(fixed);
      return fixed;
    } catch {
      // try next candidate
    }
  }

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }
  if (start !== -1) {
    return text.slice(start);
  }
  return "[]";
}

export function parseAiJsonArray(text: string): any[] {
  const candidates = collectJsonCandidates(text);
  for (const candidate of candidates) {
    const parsed = tryParseJsonArray(candidate);
    if (parsed !== null) return parsed;
  }
  return [];
}
