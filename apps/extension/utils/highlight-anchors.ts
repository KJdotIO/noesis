import type { GuestHighlight } from "./guest-storage";

export function normalizeSearchText(value: string): string {
  let normalized = "";
  let previousWasWhitespace = true;

  for (const character of value) {
    if (/\s/.test(character)) {
      if (!previousWasWhitespace) {
        normalized += " ";
        previousWasWhitespace = true;
      }
      continue;
    }

    normalized += character;
    previousWasWhitespace = false;
  }

  return normalized.trimEnd();
}

export function getNormalizedQuote(quote: string): string {
  return normalizeSearchText(quote).trim();
}

function normalizePrefix(prefix: string): string {
  return normalizeSearchText(`${prefix}x`).slice(0, -1);
}

function normalizeSuffix(suffix: string): string {
  return normalizeSearchText(`x${suffix}`).slice(1);
}

export function countNormalizedOccurrences(text: string, quote: string): number {
  const normalizedQuote = getNormalizedQuote(quote);
  const normalizedText = normalizeSearchText(text);
  if (!normalizedQuote) {
    return 0;
  }

  let count = 0;
  let index = normalizedText.indexOf(normalizedQuote);

  while (index >= 0) {
    count += 1;
    index = normalizedText.indexOf(normalizedQuote, index + normalizedQuote.length);
  }

  return count;
}

export function findNormalizedQuotePosition(
  text: string,
  highlight: Pick<
    GuestHighlight,
    "quote" | "textPosition" | "occurrenceIndex" | "prefix" | "suffix"
  >,
): number | undefined {
  const normalizedQuote = getNormalizedQuote(highlight.quote);
  if (!normalizedQuote) {
    return undefined;
  }

  if (
    highlight.textPosition !== undefined &&
    text.slice(
      highlight.textPosition,
      highlight.textPosition + normalizedQuote.length,
    ) === normalizedQuote
  ) {
    return highlight.textPosition;
  }

  const positions: number[] = [];
  let index = text.indexOf(normalizedQuote);
  while (index >= 0) {
    positions.push(index);
    index = text.indexOf(normalizedQuote, index + normalizedQuote.length);
  }

  if (positions.length === 0) {
    return undefined;
  }

  if (
    highlight.occurrenceIndex !== undefined &&
    positions[highlight.occurrenceIndex] !== undefined
  ) {
    return positions[highlight.occurrenceIndex];
  }

  if (highlight.prefix || highlight.suffix) {
    const normalizedPrefix = highlight.prefix
      ? normalizePrefix(highlight.prefix)
      : undefined;
    const normalizedSuffix = highlight.suffix
      ? normalizeSuffix(highlight.suffix)
      : undefined;
    const contextualPosition = positions.find((position) => {
      const prefix = normalizedPrefix
        ? text
            .slice(Math.max(0, position - normalizedPrefix.length), position)
            .endsWith(normalizedPrefix)
        : true;
      const suffix = normalizedSuffix
        ? text
            .slice(position + normalizedQuote.length)
            .startsWith(normalizedSuffix)
        : true;

      return prefix && suffix;
    });

    if (contextualPosition !== undefined) {
      return contextualPosition;
    }
  }

  return positions[0];
}
