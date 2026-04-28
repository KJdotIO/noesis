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
import type { NoesisMessage, SaveEntryResponse } from "../utils/messages";
import { getSepEntryContext } from "../utils/sep";

type SelectionAnchor = {
  occurrenceIndex?: number;
  prefix?: string;
  suffix?: string;
};

const highlightColors: Record<HighlightColor, string> = {
  yellow: "#fff3a3",
  green: "#bbf7d0",
  blue: "#bfdbfe",
  pink: "#fbcfe8",
  purple: "#ddd6fe",
};

function getScrollRatio(): number {
  const maxScroll =
    document.documentElement.scrollHeight - window.innerHeight;

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
      background: var(--noesis-highlight-color, #fff3a3);
      border-radius: 2px;
      box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.25);
    }

    .noesis-highlights-hidden .noesis-highlight {
      background: transparent;
      box-shadow: none;
    }

    ::highlight(noesis-pending) {
      background: #bfdbfe;
    }

    .noesis-selection-card {
      background: #171717;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.24);
      color: #ffffff;
      font: 13px system-ui, sans-serif;
      padding: 10px;
      position: absolute;
      width: 220px;
      z-index: 2147483647;
    }

    .noesis-selection-card textarea {
      border: 0;
      border-radius: 6px;
      box-sizing: border-box;
      font: inherit;
      margin: 8px 0;
      min-height: 58px;
      padding: 8px;
      resize: vertical;
      width: 100%;
    }

    .noesis-selection-actions {
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
      border: 2px solid transparent;
      border-radius: 999px;
      display: block;
      height: 20px;
      width: 20px;
    }

    .noesis-color-options input:checked + .noesis-color-swatch {
      border-color: #ffffff;
      box-shadow: 0 0 0 2px #171717;
    }

    .noesis-selection-card button {
      border: 0;
      border-radius: 6px;
      cursor: pointer;
      font: inherit;
      font-weight: 700;
      padding: 7px 9px;
    }

    .noesis-highlight-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
      color: #171717;
      font: 13px system-ui, sans-serif;
      max-width: 260px;
      padding: 10px;
      position: absolute;
      z-index: 2147483647;
    }

    .noesis-highlight-card p {
      margin: 0 0 10px;
    }

    .noesis-highlight-card textarea {
      border: 1px solid #d1d5db;
      border-radius: 6px;
      box-sizing: border-box;
      font: inherit;
      margin: 8px 0;
      min-height: 64px;
      padding: 8px;
      resize: vertical;
      width: 100%;
    }

    .noesis-highlight-card button {
      border: 0;
      border-radius: 6px;
      cursor: pointer;
      font: inherit;
      font-weight: 700;
      padding: 7px 9px;
    }

    .noesis-highlight-card-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .noesis-highlight-card-actions button:first-child {
      background: #f3f4f6;
      color: #171717;
    }

    .noesis-highlight-card-actions button:last-child {
      background: #fee2e2;
      color: #991b1b;
    }

    .noesis-anchor-warning {
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.14);
      color: #7c2d12;
      font: 13px system-ui, sans-serif;
      max-width: 320px;
      padding: 10px 12px;
      position: fixed;
      right: 16px;
      top: 16px;
      z-index: 2147483647;
    }

    .noesis-anchor-warning strong {
      display: block;
      margin-bottom: 4px;
    }

    .noesis-anchor-warning button {
      background: transparent;
      border: 0;
      color: #9a3412;
      cursor: pointer;
      font: inherit;
      font-weight: 700;
      margin-top: 6px;
      padding: 0;
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

function findTextPosition(root: HTMLElement, quote: string): number | undefined {
  const position = root.innerText.indexOf(quote);
  return position >= 0 ? position : undefined;
}

function countOccurrences(text: string, quote: string): number {
  if (!quote) {
    return 0;
  }

  let count = 0;
  let index = text.indexOf(quote);

  while (index >= 0) {
    count += 1;
    index = text.indexOf(quote, index + quote.length);
  }

  return count;
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

  return {
    occurrenceIndex: countOccurrences(before, quote),
    prefix: before.slice(-80),
    suffix: afterRange.toString().slice(0, 80),
  };
}

function setPendingSelection(range: Range): void {
  const highlightApi = CSS as unknown as {
    highlights?: {
      set: (name: string, highlight: unknown) => void;
    };
  };
  const highlightCtor = globalThis as unknown as {
    Highlight?: new (range: Range) => unknown;
  };

  if (!highlightApi.highlights || !highlightCtor.Highlight) {
    return;
  }

  highlightApi.highlights.set(
    "noesis-pending",
    new highlightCtor.Highlight(range),
  );
}

function clearPendingSelection(): void {
  const highlightApi = CSS as unknown as {
    highlights?: {
      delete: (name: string) => void;
    };
  };

  highlightApi.highlights?.delete("noesis-pending");
}

function setHighlightsVisible(visible: boolean): void {
  document.documentElement.classList.toggle("noesis-highlights-hidden", !visible);
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

function unwrapHighlight(mark: HTMLElement): void {
  mark.replaceWith(...mark.childNodes);
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
    const color = formData.get("color")?.toString() as HighlightColor;

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
    if ((event.target as HTMLElement).dataset.action !== "delete") {
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

function highlightTextNode(
  node: Text,
  start: number,
  length: number,
  highlight: GuestHighlight,
): void {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + length);

  const mark = document.createElement("mark");
  mark.className = "noesis-highlight";
  mark.dataset.noesisHighlightId = highlight.id;
  mark.title = highlight.note || "Noesis highlight";
  mark.style.setProperty(
    "--noesis-highlight-color",
    highlightColors[highlight.color ?? "yellow"],
  );
  mark.addEventListener("click", () => showHighlightCard(mark, highlight));
  range.surroundContents(mark);
}

function showAnchorWarning(unresolvedCount: number): void {
  document.querySelector(".noesis-anchor-warning")?.remove();

  if (unresolvedCount === 0) {
    return;
  }

  const warning = document.createElement("aside");
  warning.className = "noesis-anchor-warning";
  warning.innerHTML = `
    <strong>Noesis could not place ${unresolvedCount} ${
      unresolvedCount === 1 ? "highlight" : "highlights"
    }.</strong>
    <span>The entry text may have changed. Your saved notes are still in the popup.</span>
    <button type="button">Dismiss</button>
  `;
  warning.querySelector("button")?.addEventListener("click", () => {
    warning.remove();
  });
  document.body.append(warning);
}

function renderHighlight(root: HTMLElement, highlight: GuestHighlight): boolean {
  if (!highlight.quote.trim()) {
    return false;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  let seen = 0;

  while (node) {
    const parent = node.parentElement;
    if (
      parent &&
      isInsideSepTextRegion(parent) &&
      !parent.closest(".noesis-highlight, .noesis-selection-card")
    ) {
      let index = node.data.indexOf(highlight.quote);
      while (index >= 0) {
        if (
          highlight.occurrenceIndex === undefined ||
          seen === highlight.occurrenceIndex
        ) {
          highlightTextNode(node, index, highlight.quote.length, highlight);
          return true;
        }

        seen += 1;
        index = node.data.indexOf(highlight.quote, index + highlight.quote.length);
      }
    }

    node = walker.nextNode() as Text | null;
  }

  return false;
}

function isNoesisUiElement(element: HTMLElement): boolean {
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
    if ((event.target as HTMLElement).dataset.action === "cancel") {
      clearSelectionCard();
    }
  });

  card.addEventListener("submit", (event) => {
    event.preventDefault();
    const note = new FormData(card).get("note")?.toString().trim();
    const color = new FormData(card).get("color")?.toString() as HighlightColor;
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

    window.addEventListener(
      "scroll",
      () => {
        window.clearTimeout(savePositionTimer);
        savePositionTimer = window.setTimeout(() => {
          void saveGuestReadingPosition({
            slug: entry.slug,
            url: entry.url,
            scrollY: Math.round(window.scrollY),
            scrollRatio: getScrollRatio(),
            updatedAt: new Date().toISOString(),
          });
        }, 500);
      },
      { passive: true },
    );

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
      const target = event.target as HTMLElement;

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
      const target = event.target as HTMLElement;
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
            textPosition: findTextPosition(textRoot, quote),
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
    if (savedPosition?.scrollY) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: savedPosition.scrollY });
      });
    }

    const highlights = await getGuestHighlights(entry.slug);
    window.requestAnimationFrame(() => {
      const unresolvedCount = highlights.filter(
        (highlight) => !renderHighlight(textRoot, highlight),
      ).length;
      showAnchorWarning(unresolvedCount);
    });
  },
});
