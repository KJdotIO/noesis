import {
  deleteGuestHighlight,
  getGuestHighlights,
  getGuestReadingPosition,
  readGuestState,
  saveGuestEntry,
  saveGuestHighlight,
  saveGuestReadingPosition,
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

    .noesis-highlight-card button {
      background: #fee2e2;
      border: 0;
      border-radius: 6px;
      color: #991b1b;
      cursor: pointer;
      font: inherit;
      font-weight: 700;
      padding: 7px 9px;
    }
  `;
  document.head.append(style);
}

function findTextPosition(quote: string): number | undefined {
  return document.body?.innerText.indexOf(quote) ?? undefined;
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

function getSelectionAnchor(selection: Selection, quote: string) {
  if (!document.body || selection.rangeCount === 0) {
    return {};
  }

  const range = selection.getRangeAt(0);
  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(document.body);
  beforeRange.setEnd(range.startContainer, range.startOffset);

  const before = beforeRange.toString();
  const afterRange = document.createRange();
  afterRange.selectNodeContents(document.body);
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

  const note = document.createElement("p");
  note.textContent = highlight.note || "No note yet.";
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "Delete highlight";

  card.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });

  deleteButton.addEventListener("click", () => {
    void deleteGuestHighlight(highlight.slug, highlight.id).then(() => {
      unwrapHighlight(mark);
      card.remove();
    });
  });

  card.append(note, deleteButton);
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

function renderHighlight(highlight: GuestHighlight): boolean {
  if (!highlight.quote.trim()) {
    return false;
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  let seen = 0;

  while (node) {
    const parent = node.parentElement;
    if (!parent?.closest(".noesis-highlight, .noesis-selection-card")) {
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

function clearSelectionCard(): void {
  document.querySelector(".noesis-selection-card")?.remove();
  clearPendingSelection();
}

function showSelectionCard(
  selection: Selection,
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
  const anchor = getSelectionAnchor(selection, quote);
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
      if ((event.target as HTMLElement).closest(".noesis-selection-card")) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        return;
      }

      showSelectionCard(
        selection,
        guestState.settings.defaultHighlightColor,
        (quote, note, color, anchor) => {
          void saveGuestHighlight({
            slug: entry.slug,
            quote,
            note,
            url: entry.url,
            color,
            textPosition: findTextPosition(quote),
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
            renderHighlight(highlight);
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
      highlights.forEach(renderHighlight);
    });
  },
});
