import {
  getGuestReadingPosition,
  saveGuestEntry,
  saveGuestReadingPosition,
} from "../utils/guest-storage";
import type { NoesisMessage, SaveEntryResponse } from "../utils/messages";
import { getSepEntryContext } from "../utils/sep";

function getScrollRatio(): number {
  const maxScroll =
    document.documentElement.scrollHeight - window.innerHeight;

  return maxScroll > 0 ? window.scrollY / maxScroll : 0;
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

    const savedPosition = await getGuestReadingPosition(entry.slug);
    if (savedPosition?.scrollY) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: savedPosition.scrollY });
      });
    }
  },
});
