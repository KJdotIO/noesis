import { useEffect, useState } from "react";
import { readGuestState, saveGuestEntry } from "../../utils/guest-storage";
import { deriveSepSlug, type SepEntryContext } from "../../utils/sep";
import "./App.css";

type SaveStatus =
  | { type: "idle"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type PageState =
  | {
      supported: false;
      message: string;
    }
  | {
      supported: true;
      entry: SepEntryContext;
      saved: boolean;
      highlightCount: number;
      progress: number | null;
    };

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

async function activatePageTools(tabId: number): Promise<void> {
  await browser.scripting.executeScript({
    target: { tabId },
    files: ["/content-scripts/content.js"],
  });
}

function App() {
  const [status, setStatus] = useState<SaveStatus>({
    type: "idle",
    message: "Checking current tab...",
  });
  const [pageState, setPageState] = useState<PageState>({
    supported: false,
    message: "Checking current tab...",
  });

  async function loadPageState() {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      setPageState({ supported: false, message: "No active tab found." });
      return;
    }

    try {
      const entry = await getEntryFromTab(tab);
      const guestState = await readGuestState();
      const position = guestState.readingPositions[entry.slug];

      setPageState({
        supported: true,
        entry,
        saved: Boolean(guestState.savedEntries[entry.slug]),
        highlightCount: guestState.highlights[entry.slug]?.length ?? 0,
        progress: position ? Math.round(position.scrollRatio * 100) : null,
      });
      setStatus({ type: "idle", message: "Ready." });
    } catch (error) {
      setPageState({
        supported: false,
        message:
          error instanceof Error
            ? error.message
            : "Open a Stanford Encyclopedia entry first.",
      });
      setStatus({
        type: "idle",
        message: "Open an SEP entry, then save it here.",
      });
    }
  }

  useEffect(() => {
    void loadPageState();
  }, []);

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
      await activatePageTools(tab.id);
      await loadPageState();

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
      <h1>
        {pageState.supported ? pageState.entry.title : "SEP companion"}
      </h1>
      {pageState.supported ? (
        <section className="summary">
          <span>{pageState.saved ? "Saved" : "Not saved yet"}</span>
          <span>{pageState.highlightCount} highlights</span>
          <span>
            {pageState.progress === null
              ? "No progress yet"
              : `${pageState.progress}% read`}
          </span>
        </section>
      ) : (
        <p className="description">{pageState.message}</p>
      )}
      <button
        type="button"
        onClick={saveCurrentEntry}
        disabled={!pageState.supported}
      >
        {pageState.supported && pageState.saved
          ? "Save again"
          : "Save current entry"}
      </button>
      <p className={`status status-${status.type}`}>{status.message}</p>
    </main>
  );
}

export default App;
