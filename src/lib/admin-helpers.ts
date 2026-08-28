export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

export type ParsedCompanyRow = {
  name: string;
  contactName: string | null;
  contactDesignation: string | null;
  contactEmail: string | null;
};

/** Splits one CSV line into fields, respecting double-quoted fields that may contain commas. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

const HEADER_HINTS = ["company", "organisation", "organization"];

export function parseCompanyRows(raw: string): ParsedCompanyRow[] {
  const seen = new Set<string>();
  const out: ParsedCompanyRow[] = [];
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    const fields = splitCsvLine(line).map((field) => field.trim());
    const name = fields[0] ?? "";
    if (!name) continue;

    // Skip an obvious header row (only checked on the very first non-empty line).
    if (index === 0 && HEADER_HINTS.some((hint) => name.toLowerCase() === hint)) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const first = fields[2]?.trim() || "";
    const last = fields[3]?.trim() || "";
    const contactName = [first, last].filter(Boolean).join(" ").trim() || null;
    const contactDesignation = fields[4]?.trim() || null;
    const contactEmail = fields[5]?.trim() || null;

    out.push({ name, contactName, contactDesignation, contactEmail });
  }
  return out;
}

/** Back-compat: plain list of names, e.g. for one-per-line paste with no CSV columns. */
export function parseCompanyNames(raw: string): string[] {
  return parseCompanyRows(raw).map((row) => row.name);
}
