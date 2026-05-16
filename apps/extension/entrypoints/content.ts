import {
  deleteGuestHighlight,
  getGuestHighlights,
  getGuestReadingPosition,
  readGuestState,
  saveGuestEntry,
  saveGuestHighlight,
  saveGuestReadingPosition,
  updateGuestHighlight,
} from "../utils/guest-storage";
import type { GuestHighlight, HighlightColor } from "../utils/guest-storage";
import {
  countNormalizedOccurrences,
  findNormalizedQuotePosition,
  getNormalizedQuote,
  normalizeSearchText,
} from "../utils/highlight-anchors";
import type { NoesisMessage, SaveEntryResponse } from "../utils/messages";
import { getSepEntryContext } from "../utils/sep";

type SelectionAnchor = {
  textPosition?: number;
  occurrenceIndex?: number;
  prefix?: string;
  suffix?: string;
};

type TextAnchor = {
  node: Text;
  offset: number;
};

type HighlightableTextIndex = {
  text: string;
  anchors: Array<TextAnchor | null>;
};

const highlightColors: Record<HighlightColor, string> = {
  yellow: "oklch(90% 0.055 103)",
  green: "oklch(88% 0.06 145)",
  blue: "oklch(88% 0.045 235)",
  pink: "oklch(89% 0.055 15)",
  purple: "oklch(88% 0.045 300)",
};

function isHighlightColor(value: string): value is HighlightColor {
  return value in highlightColors;
}

function getScrollRatio(): number {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

  return maxScroll > 0 ? window.scrollY / maxScroll : 0;
}

function injectHighlightStyles(): void {
  if (document.getElementById("noesis-highlight-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "noesis-highlight-style";
  style.textContent = `
    .noesis-highlight {
      background: var(--noesis-highlight-color, oklch(94% 0.04 78));
      border-radius: 2px;
      box-decoration-break: clone;
      box-shadow: 0 0 0 1px color-mix(in oklch, var(--noesis-highlight-color) 72%, oklch(18% 0.012 72));
    }

    .noesis-highlights-hidden .noesis-highlight {
      background: transparent;
      box-shadow: none;
    }

    ::highlight(noesis-pending) {
      background: oklch(93% 0.024 235);
    }

    .noesis-selection-card,
    .noesis-highlight-card,
    .noesis-anchor-warning {
      font: 13px/1.5 "Avenir Next", "Gill Sans", ui-sans-serif, sans-serif;
      letter-spacing: -0.005em;
      z-index: 2147483647;
    }

    .noesis-selection-card {
      background: oklch(99% 0.004 82);
      border: 1px solid oklch(89.5% 0.008 82);
      border-radius: 10px;
      color: oklch(18% 0.012 72);
      padding: 12px;
      position: absolute;
      width: 238px;
    }

    .noesis-selection-card textarea,
    .noesis-highlight-card textarea {
      background: oklch(99% 0.004 82);
      border: 1px solid oklch(89.5% 0.008 82);
      border-radius: 8px;
      box-sizing: border-box;
      color: oklch(18% 0.012 72);
      font: inherit;
      margin: 8px 0;
      min-height: 60px;
      padding: 8px;
      resize: vertical;
      width: 100%;
    }

    .noesis-selection-card textarea:focus-visible,
    .noesis-highlight-card textarea:focus-visible,
    .noesis-selection-card button:focus-visible,
    .noesis-highlight-card button:focus-visible,
    .noesis-anchor-warning button:focus-visible {
      outline: 2px solid oklch(43% 0.054 105);
      outline-offset: 2px;
    }

    .noesis-selection-actions,
    .noesis-highlight-card-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .noesis-color-options {
      display: flex;
      gap: 6px;
      margin: 0 0 8px;
    }

    .noesis-color-options label {
      cursor: pointer;
      display: block;
      height: 20px;
      position: relative;
      width: 20px;
    }

    .noesis-color-options input {
      opacity: 0;
      position: absolute;
    }

    .noesis-color-swatch {
      border: 1px solid color-mix(in oklch, currentColor 18%, transparent);
      border-radius: 999px;
      display: block;
      height: 20px;
      width: 20px;
    }

    .noesis-color-options input:checked + .noesis-color-swatch {
      box-shadow:
        0 0 0 2px oklch(99% 0.004 82),
        0 0 0 3px oklch(18% 0.012 72);
    }

    .noesis-selection-card button,
    .noesis-highlight-card button,
    .noesis-anchor-warning button {
      border: 1px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      font: inherit;
      font-weight: 720;
      padding: 7px 9px;
      transition:
        background 180ms cubic-bezier(0.16, 1, 0.3, 1),
        border-color 180ms cubic-bezier(0.16, 1, 0.3, 1),
        color 180ms cubic-bezier(0.16, 1, 0.3, 1),
        transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    .noesis-selection-card button:active,
    .noesis-highlight-card button:active,
    .noesis-anchor-warning button:active {
      transform: scale(0.985);
    }

    .noesis-selection-actions button:first-child {
      background: oklch(97.8% 0.007 82);
      border-color: oklch(89.5% 0.008 82);
      color: oklch(18% 0.012 72);
    }

    .noesis-selection-actions button:first-child:hover {
      border-color: oklch(82% 0.011 82);
    }

    .noesis-selection-actions button:last-child {
      background: oklch(18% 0.012 72);
      color: oklch(99% 0.004 82);
    }

    .noesis-selection-actions button:last-child:hover {
      background: oklch(25% 0.014 72);
    }

    .noesis-highlight-card {
      background: oklch(99% 0.004 82);
      border: 1px solid oklch(89.5% 0.008 82);
      border-radius: 10px;
      color: oklch(18% 0.012 72);
      max-width: 284px;
      padding: 12px;
      position: absolute;
    }

    .noesis-highlight-card p {
      color: oklch(31% 0.014 72);
      margin: 0 0 10px;
    }

    .noesis-highlight-card textarea {
      background: oklch(97.8% 0.007 82);
    }

    .noesis-highlight-card-actions button:first-child {
      background: oklch(97.8% 0.007 82);
      border-color: oklch(89.5% 0.008 82);
      color: oklch(18% 0.012 72);
    }

    .noesis-highlight-card-actions button:first-child:hover {
      border-color: oklch(82% 0.011 82);
    }

    .noesis-highlight-card-actions button:last-child {
      background: oklch(94% 0.035 26);
      color: oklch(45% 0.09 28);
    }

    .noesis-anchor-warning {
      background: oklch(99% 0.004 82);
      border: 1px solid oklch(88% 0.04 78);
      border-radius: 10px;
      color: oklch(46% 0.06 78);
      max-width: 320px;
      padding: 10px 12px;
      position: fixed;
      right: 16px;
      top: 16px;
    }

    .noesis-anchor-warning strong {
      color: oklch(18% 0.012 72);
      display: block;
      margin-bottom: 4px;
    }

    .noesis-anchor-warning button {
      background: transparent;
      color: oklch(43% 0.054 105);
      margin-top: 6px;
      padding: 0;
    }

    .noesis-anchor-warning button:hover {
      color: oklch(18% 0.012 72);
      text-decoration: underline;
    }
  `;
  document.head.append(style);
}

function getSepTextRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>("#article-content");
}

function isInsideSepTextRegion(element: HTMLElement): boolean {
  return Boolean(element.closest("#preamble, #main-text"));
}

function getElementFromNode(node: Node): HTMLElement | null {
  return node instanceof HTMLElement ? node : node.parentElement;
}

function getHighlightBlock(element: HTMLElement): HTMLElement | null {
  return element.closest<HTMLElement>(
    "p, blockquote, li, dd, dt, pre, h1, h2, h3, h4, h5, h6",
  );
}

function rangeFitsSingleHighlightBlock(range: Range): boolean {
  const startElement = getElementFromNode(range.startContainer);
  const endElement = getElementFromNode(range.endContainer);
  if (!startElement || !endElement) {
    return false;
  }

  const startBlock = getHighlightBlock(startElement);
  const endBlock = getHighlightBlock(endElement);
  return Boolean(startBlock && startBlock === endBlock);
}

function selectionIsInsideSepText(selection: Selection): boolean {
  if (selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  const startElement = getElementFromNode(range.startContainer);
  const endElement = getElementFromNode(range.endContainer);

  return Boolean(
    startElement &&
    endElement &&
    isInsideSepTextRegion(startElement) &&
    isInsideSepTextRegion(endElement),
  );
}

function selectionFitsSingleHighlightBlock(selection: Selection): boolean {
  if (selection.rangeCount === 0) {
    return false;
  }

  return rangeFitsSingleHighlightBlock(selection.getRangeAt(0));
}

function findTextPosition(
  root: HTMLElement,
  quote: string,
): number | undefined {
  const position = collectHighlightableText(root).text.indexOf(
    getNormalizedQuote(quote),
  );
  return position >= 0 ? position : undefined;
}

function shouldSkipTextNode(node: Text): boolean {
  return Boolean(
    node.parentElement?.closest(
      ".noesis-selection-card, .noesis-highlight-card, .noesis-anchor-warning",
    ),
  );
}

function appendTextCharacter(
  index: HighlightableTextIndex,
  character: string,
  anchor: TextAnchor | null,
): void {
  const isWhitespace = /\s/.test(character);
  if (isWhitespace) {
    appendTextSeparator(index, anchor);
    return;
  }

  index.text += character;
  index.anchors.push(anchor);
}

function appendTextSeparator(
  index: HighlightableTextIndex,
  anchor: TextAnchor | null,
): void {
  if (!index.text || index.text.endsWith(" ")) {
    return;
  }

  index.text += " ";
  index.anchors.push(anchor);
}

function appendTextNode(index: HighlightableTextIndex, node: Text): void {
  for (let offset = 0; offset < node.data.length; offset += 1) {
    appendTextCharacter(index, node.data[offset] ?? "", { node, offset });
  }
}

function isBlockBoundary(element: HTMLElement): boolean {
  return [
    "ADDRESS",
    "ARTICLE",
    "ASIDE",
    "BLOCKQUOTE",
    "DD",
    "DIV",
    "DL",
    "DT",
    "FIGCAPTION",
    "FIGURE",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "LI",
    "OL",
    "P",
    "PRE",
    "SECTION",
    "TABLE",
    "UL",
  ].includes(element.tagName);
}

function collectHighlightableText(root: HTMLElement): HighlightableTextIndex {
  const index: HighlightableTextIndex = { text: "", anchors: [] };

  const visit = (node: Node): void => {
    if (node instanceof Text) {
      const parent = node.parentElement;
      if (
        parent &&
        isInsideSepTextRegion(parent) &&
        !shouldSkipTextNode(node)
      ) {
        appendTextNode(index, node);
      }
      return;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (
      node.matches(
        ".noesis-selection-card, .noesis-highlight-card, .noesis-anchor-warning",
      )
    ) {
      return;
    }

    if (node.tagName === "BR" && isInsideSepTextRegion(node)) {
      appendTextSeparator(index, null);
      return;
    }

    for (const child of node.childNodes) {
      visit(child);
    }

    if (node !== root && isInsideSepTextRegion(node) && isBlockBoundary(node)) {
      appendTextSeparator(index, null);
    }
  };

  visit(root);
  const hasTrailingSpace = index.text.endsWith(" ");
  return {
    text: index.text.trimEnd(),
    anchors: hasTrailingSpace ? index.anchors.slice(0, -1) : index.anchors,
  };
}

function findQuotePosition(
  text: string,
  highlight: GuestHighlight,
): number | undefined {
  return findNormalizedQuotePosition(text, highlight);
}

function createTextRange(
  anchors: Array<TextAnchor | null>,
  start: number,
  length: number,
): Range | null {
  const end = start + length;
  let startAnchor: TextAnchor | null = null;
  let endAnchor: TextAnchor | null = null;

  for (let index = start; index < end; index += 1) {
    const anchor = anchors[index];
    if (anchor) {
      startAnchor = anchor;
      break;
    }
  }

  for (let index = end - 1; index >= start; index -= 1) {
    const anchor = anchors[index];
    if (anchor) {
      endAnchor = anchor;
      break;
    }
  }

  if (!startAnchor || !endAnchor) {
    return null;
  }

  const range = document.createRange();
  range.setStart(startAnchor.node, startAnchor.offset);
  range.setEnd(endAnchor.node, endAnchor.offset + 1);
  return range;
}

function findRangeStartTextPosition(
  root: HTMLElement,
  range: Range,
): number | undefined {
  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(root);
  try {
    beforeRange.setEnd(range.startContainer, range.startOffset);
  } catch {
    return undefined;
  }
  return normalizeSearchText(beforeRange.toString()).length;
}

function getSelectionAnchor(
  root: HTMLElement,
  selection: Selection,
  quote: string,
) {
  if (selection.rangeCount === 0) {
    return {};
  }

  const range = selection.getRangeAt(0);
  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(root);
  beforeRange.setEnd(range.startContainer, range.startOffset);

  const before = beforeRange.toString();
  const afterRange = document.createRange();
  afterRange.selectNodeContents(root);
  afterRange.setStart(range.endContainer, range.endOffset);
  const textPosition = findRangeStartTextPosition(root, range);

  return {
    textPosition,
    occurrenceIndex: countNormalizedOccurrences(before, quote),
    prefix: normalizeSearchText(before).slice(-80),
    suffix: normalizeSearchText(afterRange.toString()).slice(0, 80),
  };
}

function setPendingSelection(range: Range): void {
  // TypeScript ships the Custom Highlight API types, but not every runtime
  // actually implements them.
  const highlights = (CSS as { highlights?: HighlightRegistry }).highlights;
  if (!highlights || typeof Highlight !== "function") {
    return;
  }

  highlights.set("noesis-pending", new Highlight(range));
}

function clearPendingSelection(): void {
  const highlights = (CSS as { highlights?: HighlightRegistry }).highlights;
  highlights?.delete("noesis-pending");
}

function setHighlightsVisible(visible: boolean): void {
  document.documentElement.classList.toggle(
    "noesis-highlights-hidden",
    !visible,
  );
}

function scrollToHighlight(highlightId: string): void {
  const mark = document.querySelector<HTMLElement>(
    `.noesis-highlight[data-noesis-highlight-id="${CSS.escape(highlightId)}"]`,
  );

  if (!mark) {
    return;
  }

  mark.scrollIntoView({ behavior: "smooth", block: "center" });
  mark.click();
}

function restoreReadingPosition(position: {
  scrollY: number;
  scrollRatio: number;
}): void {
  if (window.location.hash) {
    return;
  }

  const scrollToSavedPosition = () => {
    const maxScroll =
      document.documentElement.scrollHeight - window.innerHeight;
    const scrollY =
      position.scrollY > 0
        ? Math.min(position.scrollY, Math.max(0, maxScroll))
        : Math.round(Math.max(0, maxScroll) * position.scrollRatio);

    window.scrollTo({ top: scrollY });
  };

  window.requestAnimationFrame(scrollToSavedPosition);
  window.addEventListener(
    "load",
    () => {
      window.setTimeout(scrollToSavedPosition, 100);
    },
    { once: true },
  );
}

function unwrapHighlight(mark: HTMLElement): void {
  mark.replaceWith(...mark.childNodes);
}

function clearRenderedHighlights(): void {
  for (const mark of document.querySelectorAll<HTMLElement>(
    ".noesis-highlight",
  )) {
    unwrapHighlight(mark);
  }
}

function clearHighlightCard(): void {
  document.querySelector(".noesis-highlight-card")?.remove();
}

function showHighlightCard(mark: HTMLElement, highlight: GuestHighlight): void {
  clearHighlightCard();

  const rect = mark.getBoundingClientRect();
  const card = document.createElement("div");
  card.className = "noesis-highlight-card";
  card.style.left = `${Math.max(12, rect.left + window.scrollX)}px`;
  card.style.top = `${Math.max(12, rect.bottom + window.scrollY + 8)}px`;

  const form = document.createElement("form");
  form.innerHTML = `
    <strong>Edit highlight</strong>
    <textarea name="note" placeholder="Optional note"></textarea>
    <div class="noesis-color-options" aria-label="Highlight color">
      ${Object.entries(highlightColors)
        .map(
          ([color, value]) => `
            <label title="${color}">
              <input type="radio" name="color" value="${color}" ${
                color === (highlight.color ?? "yellow") ? "checked" : ""
              }>
              <span class="noesis-color-swatch" style="background: ${value}"></span>
            </label>
          `,
        )
        .join("")}
    </div>
    <div class="noesis-highlight-card-actions">
      <button type="submit">Save</button>
      <button type="button" data-action="delete">Delete</button>
    </div>
  `;
  const noteInput = form.querySelector<HTMLTextAreaElement>(
    "textarea[name='note']",
  );
  if (noteInput) {
    noteInput.value = highlight.note ?? "";
  }

  card.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const note = formData.get("note")?.toString().trim();
    const colorValue = formData.get("color");
    const color =
      typeof colorValue === "string" && isHighlightColor(colorValue)
        ? colorValue
        : undefined;

    void updateGuestHighlight(highlight.slug, highlight.id, {
      note: note || undefined,
      color: color || highlight.color,
    }).then((updatedHighlight) => {
      if (!updatedHighlight) {
        return;
      }

      mark.title = updatedHighlight.note || "Noesis highlight";
      mark.style.setProperty(
        "--noesis-highlight-color",
        highlightColors[updatedHighlight.color ?? "yellow"],
      );
      card.remove();
    });
  });

  form.addEventListener("click", (event) => {
    const target = event.target;
    if (
      !(target instanceof HTMLElement) ||
      target.dataset.action !== "delete"
    ) {
      return;
    }

    void deleteGuestHighlight(highlight.slug, highlight.id).then(() => {
      unwrapHighlight(mark);
      card.remove();
    });
  });

  card.append(form);
  document.body.append(card);
}

function highlightRange(range: Range, highlight: GuestHighlight): void {
  const mark = document.createElement("mark");
  mark.className = "noesis-highlight";
  mark.dataset.noesisHighlightId = highlight.id;
  mark.title = highlight.note || "Noesis highlight";
  mark.style.setProperty(
    "--noesis-highlight-color",
    highlightColors[highlight.color ?? "yellow"],
  );
  mark.addEventListener("click", () => showHighlightCard(mark, highlight));
  mark.append(range.extractContents());
  range.insertNode(mark);
}

function showNoesisWarning(title: string, message: string): void {
  document.querySelector(".noesis-anchor-warning")?.remove();

  const warning = document.createElement("aside");
  warning.className = "noesis-anchor-warning";
  warning.innerHTML = `
    <strong>${title}</strong>
    <span>${message}</span>
    <button type="button">Dismiss</button>
  `;
  warning.querySelector("button")?.addEventListener("click", () => {
    warning.remove();
  });
  document.body.append(warning);
}

function showAnchorWarning(unresolvedCount: number): void {
  if (unresolvedCount === 0) {
    return;
  }

  showNoesisWarning(
    `Noesis could not place ${unresolvedCount} ${
      unresolvedCount === 1 ? "highlight" : "highlights"
    }.`,
    "The entry text may have changed. Your saved notes are still in the popup.",
  );
}

function showCrossBlockSelectionWarning(): void {
  showNoesisWarning(
    "Noesis can highlight one block at a time.",
    "Select either the paragraph or the displayed logic block, then save that highlight separately.",
  );
}

function renderHighlight(
  root: HTMLElement,
  highlight: GuestHighlight,
): boolean {
  if (!highlight.quote.trim()) {
    return false;
  }

  const { text, anchors } = collectHighlightableText(root);
  const position = findQuotePosition(text, highlight);
  const normalizedQuote = getNormalizedQuote(highlight.quote);
  const range =
    position === undefined
      ? null
      : createTextRange(anchors, position, normalizedQuote.length);

  if (!range) {
    return false;
  }

  if (!rangeFitsSingleHighlightBlock(range)) {
    return false;
  }

  try {
    highlightRange(range, highlight);
  } catch {
    return false;
  }
  return true;
}

async function renderStoredHighlights(
  root: HTMLElement,
  slug: string,
): Promise<number> {
  clearHighlightCard();
  clearRenderedHighlights();
  const highlights = await getGuestHighlights(slug);
  const unresolvedCount = highlights.filter(
    (highlight) => !renderHighlight(root, highlight),
  ).length;
  showAnchorWarning(unresolvedCount);
  return unresolvedCount;
}

function isNoesisUiElement(element: Element): boolean {
  return Boolean(
    element.closest(
      ".noesis-selection-card, .noesis-highlight-card, .noesis-highlight",
    ),
  );
}

function selectionTouchesNoesisUi(selection: Selection): boolean {
  if (selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  const container =
    range.commonAncestorContainer instanceof HTMLElement
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;

  return container ? isNoesisUiElement(container) : false;
}

function clearSelectionCard(): void {
  document.querySelector(".noesis-selection-card")?.remove();
  clearPendingSelection();
}

function showSelectionCard(
  selection: Selection,
  root: HTMLElement,
  defaultColor: HighlightColor,
  onSave: (
    quote: string,
    note: string | undefined,
    color: HighlightColor,
    anchor: SelectionAnchor,
  ) => void,
): void {
  clearSelectionCard();

  const quote = selection.toString().trim();
  if (!quote || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0).cloneRange();
  const rect = range.getBoundingClientRect();
  const anchor = getSelectionAnchor(root, selection, quote);
  setPendingSelection(range);
  selection.removeAllRanges();

  const card = document.createElement("form");
  card.className = "noesis-selection-card";
  card.style.left = `${Math.max(12, rect.left + window.scrollX)}px`;
  card.style.top = `${Math.max(12, rect.bottom + window.scrollY + 8)}px`;
  card.innerHTML = `
    <strong>Save highlight</strong>
    <textarea name="note" placeholder="Optional note"></textarea>
    <div class="noesis-color-options" aria-label="Highlight color">
      ${Object.entries(highlightColors)
        .map(
          ([color, value]) => `
            <label title="${color}">
              <input type="radio" name="color" value="${color}" ${
                color === defaultColor ? "checked" : ""
              }>
              <span class="noesis-color-swatch" style="background: ${value}"></span>
            </label>
          `,
        )
        .join("")}
    </div>
    <div class="noesis-selection-actions">
      <button type="button" data-action="cancel">Cancel</button>
      <button type="submit">Save</button>
    </div>
  `;

  card.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });

  card.addEventListener("mouseup", (event) => {
    event.stopPropagation();
  });

  card.addEventListener("click", (event) => {
    event.stopPropagation();
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.dataset.action === "cancel") {
      clearSelectionCard();
    }
  });

  card.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(card);
    const note = formData.get("note")?.toString().trim();
    const colorValue = formData.get("color");
    const color =
      typeof colorValue === "string" && isHighlightColor(colorValue)
        ? colorValue
        : undefined;
    onSave(quote, note || undefined, color || defaultColor, anchor);
    clearSelectionCard();
  });

  document.body.append(card);
}

export default defineContentScript({
  matches: ["https://plato.stanford.edu/entries/*"],
  async main() {
    if (document.documentElement.dataset.noesisReady === "true") {
      return;
    }

    const entry = getSepEntryContext(document);
    if (!entry) {
      return;
    }

    const textRoot = getSepTextRoot();
    if (!textRoot) {
      return;
    }

    document.documentElement.dataset.noesisSepSlug = entry.slug;
    document.documentElement.dataset.noesisReady = "true";
    injectHighlightStyles();
    let guestState = await readGuestState();
    setHighlightsVisible(guestState.settings.highlightsVisible);

    let savePositionTimer: number | undefined;
    const saveCurrentReadingPosition = () =>
      saveGuestReadingPosition({
        slug: entry.slug,
        url: entry.url,
        scrollY: Math.round(window.scrollY),
        scrollRatio: getScrollRatio(),
        updatedAt: new Date().toISOString(),
      });

    window.addEventListener(
      "scroll",
      () => {
        window.clearTimeout(savePositionTimer);
        savePositionTimer = window.setTimeout(() => {
          void saveCurrentReadingPosition();
        }, 500);
      },
      { passive: true },
    );

    const flushReadingPosition = () => {
      window.clearTimeout(savePositionTimer);
      void saveCurrentReadingPosition();
    };
    window.addEventListener("pagehide", flushReadingPosition);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushReadingPosition();
      }
    });

    browser.runtime.onMessage.addListener(
      (message: NoesisMessage): Promise<SaveEntryResponse> | undefined => {
        if (message.type === "noesis:set-highlights-visible") {
          setHighlightsVisible(message.visible);
          return undefined;
        }

        if (message.type === "noesis:scroll-to-highlight") {
          scrollToHighlight(message.highlightId);
          return undefined;
        }

        if (message.type === "noesis:refresh-highlights") {
          void renderStoredHighlights(textRoot, entry.slug);
          return undefined;
        }

        if (message.type !== "noesis:save-entry") {
          return undefined;
        }

        return saveGuestEntry(entry)
          .then(
            (savedEntry): SaveEntryResponse => ({
              ok: true,
              entry: savedEntry,
            }),
          )
          .catch((error: unknown) => ({
            ok: false,
            error: error instanceof Error ? error.message : "Save failed",
          }));
      },
    );

    document.addEventListener("pointerdown", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (!target.closest(".noesis-selection-card")) {
        clearSelectionCard();
      }

      if (
        !target.closest(".noesis-highlight-card") &&
        !target.closest(".noesis-highlight")
      ) {
        clearHighlightCard();
      }
    });

    document.addEventListener("mouseup", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (isNoesisUiElement(target)) {
        return;
      }

      const selection = window.getSelection();
      if (
        !selection ||
        selection.isCollapsed ||
        selectionTouchesNoesisUi(selection) ||
        !selectionIsInsideSepText(selection)
      ) {
        return;
      }

      if (!selectionFitsSingleHighlightBlock(selection)) {
        selection.removeAllRanges();
        showCrossBlockSelectionWarning();
        return;
      }

      showSelectionCard(
        selection,
        textRoot,
        guestState.settings.defaultHighlightColor,
        (quote, note, color, anchor) => {
          void saveGuestHighlight({
            slug: entry.slug,
            quote,
            note,
            url: entry.url,
            color,
            textPosition:
              anchor.textPosition ?? findTextPosition(textRoot, quote),
            ...anchor,
          }).then((highlight) => {
            guestState = {
              ...guestState,
              highlights: {
                ...guestState.highlights,
                [entry.slug]: [
                  ...(guestState.highlights[entry.slug] ?? []),
                  highlight,
                ],
              },
            };
            renderHighlight(textRoot, highlight);
          });
        },
      );
    });

    const savedPosition = await getGuestReadingPosition(entry.slug);
    if (savedPosition) {
      restoreReadingPosition(savedPosition);
    }

    window.requestAnimationFrame(() => {
      void renderStoredHighlights(textRoot, entry.slug);
    });
  },
});
