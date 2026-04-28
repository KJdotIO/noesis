import {
  getGuestHighlights,
  getGuestReadingPosition,
  saveGuestEntry,
  saveGuestHighlight,
  saveGuestReadingPosition,
} from "../utils/guest-storage";
import type { GuestHighlight } from "../utils/guest-storage";
import type { NoesisMessage, SaveEntryResponse } from "../utils/messages";
import { getSepEntryContext } from "../utils/sep";

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
      background: #fff3a3;
      border-radius: 2px;
      box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.25);
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

    .noesis-selection-card button {
      border: 0;
      border-radius: 6px;
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

function highlightTextNode(node: Text, start: number, length: number): void {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + length);

  const mark = document.createElement("mark");
  mark.className = "noesis-highlight";
  range.surroundContents(mark);
}

function renderHighlight(highlight: GuestHighlight): boolean {
  if (!highlight.quote.trim()) {
    return false;
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;

  while (node) {
    const parent = node.parentElement;
    if (!parent?.closest(".noesis-highlight, .noesis-selection-card")) {
      const index = node.data.indexOf(highlight.quote);
      if (index >= 0) {
        highlightTextNode(node, index, highlight.quote.length);
        return true;
      }
    }

    node = walker.nextNode() as Text | null;
  }

  return false;
}

function clearSelectionCard(): void {
  document.querySelector(".noesis-selection-card")?.remove();
}

function showSelectionCard(
  selection: Selection,
  onSave: (quote: string, note?: string) => void,
): void {
  clearSelectionCard();

  const quote = selection.toString().trim();
  if (!quote || selection.rangeCount === 0) {
    return;
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  const card = document.createElement("form");
  card.className = "noesis-selection-card";
  card.style.left = `${Math.max(12, rect.left + window.scrollX)}px`;
  card.style.top = `${Math.max(12, rect.bottom + window.scrollY + 8)}px`;
  card.innerHTML = `
    <strong>Save highlight</strong>
    <textarea name="note" placeholder="Optional note"></textarea>
    <div class="noesis-selection-actions">
      <button type="button" data-action="cancel">Cancel</button>
      <button type="submit">Save</button>
    </div>
  `;

  card.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).dataset.action === "cancel") {
      clearSelectionCard();
      selection.removeAllRanges();
    }
  });

  card.addEventListener("submit", (event) => {
    event.preventDefault();
    const note = new FormData(card).get("note")?.toString().trim();
    onSave(quote, note || undefined);
    clearSelectionCard();
    selection.removeAllRanges();
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

    document.addEventListener("mouseup", () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        return;
      }

      showSelectionCard(selection, (quote, note) => {
        void saveGuestHighlight({
          slug: entry.slug,
          quote,
          note,
          url: entry.url,
          textPosition: findTextPosition(quote),
        }).then(renderHighlight);
      });
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
