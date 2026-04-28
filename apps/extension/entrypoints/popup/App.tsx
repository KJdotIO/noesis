import { useState } from "react";
import { saveGuestEntry } from "../../utils/guest-storage";
import { deriveSepSlug, type SepEntryContext } from "../../utils/sep";
import "./App.css";

type SaveStatus =
  | { type: "idle"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

async function getEntryFromTab(tab: Browser.tabs.Tab): Promise<SepEntryContext> {
  if (!tab.id) {
    throw new Error("No active tab found.");
  }

  const [page] = await browser.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      canonicalUrl:
        document.querySelector<HTMLLinkElement>("link[rel='canonical']")
          ?.href ?? location.href,
      pageUrl: location.href,
      title:
        document
          .querySelector<HTMLMetaElement>("meta[name='DC.title']")
          ?.content.trim() ||
        document.title.replace(" (Stanford Encyclopedia of Philosophy)", "").trim(),
    }),
  });

  if (!page.result) {
    throw new Error("Could not read the active SEP page.");
  }

  const pageUrl = new URL(page.result.pageUrl);
  const slug = deriveSepSlug(pageUrl);

  if (!slug) {
    throw new Error("Open a Stanford Encyclopedia entry first.");
  }

  return {
    slug,
    title: page.result.title,
    url: page.result.canonicalUrl,
  };
}

function App() {
  const [status, setStatus] = useState<SaveStatus>({
    type: "idle",
    message: "Open an SEP entry, then save it here.",
  });

  async function saveCurrentEntry() {
    setStatus({ type: "idle", message: "Saving current entry..." });

    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        setStatus({ type: "error", message: "No active tab found." });
        return;
      }

      const entry = await getEntryFromTab(tab);
      const savedEntry = await saveGuestEntry(entry);

      setStatus({
        type: "success",
        message: `Saved “${savedEntry.title}”.`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Open a Stanford Encyclopedia entry first.",
      });
    }
  }

  return (
    <main className="popup">
      <p className="eyebrow">Noesis</p>
      <h1>SEP companion</h1>
      <p className="description">
        Save entries, highlights, and reading progress while staying on SEP.
      </p>
      <button type="button" onClick={saveCurrentEntry}>
        Save current entry
      </button>
      <p className={`status status-${status.type}`}>{status.message}</p>
    </main>
  );
}

export default App;
