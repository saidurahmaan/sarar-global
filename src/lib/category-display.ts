/**
 * Short label when the API name includes a parent suffix, e.g. "Tees in Men" → "Tees".
 * Uses the last " in …" segment only so nested names like "Sale in store in Men" become "Sale in store".
 */
export function categoryDisplayName(name: string): string {
  const trimmed = name.trim();
  const token = " in ";
  const idx = trimmed.lastIndexOf(token);
  if (idx <= 0) {
    return trimmed;
  }
  const left = trimmed.slice(0, idx).trim();
  const right = trimmed.slice(idx + token.length).trim();
  if (!left.length || !right.length) {
    return trimmed;
  }
  return left;
}

/**
 * Optional body line under a nav heading (API `description`): strips `… in …` like {@link categoryDisplayName}.
 * Returns null when empty or when it only repeats the short label (avoids “Tees” + “Tees in Men”).
 */
export function categoryNavBlurb(label: string, rawDescription?: string | null): string | null {
  if (typeof rawDescription !== "string" || !rawDescription.trim()) {
    return null;
  }
  const display = categoryDisplayName(rawDescription).trim();
  if (!display) {
    return null;
  }
  const l = label.trim().toLowerCase();
  if (l.length > 0 && display.toLowerCase() === l) {
    return null;
  }
  return display;
}
