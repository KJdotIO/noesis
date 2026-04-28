import { useState } from "react";
import type { SaveEntryResponse } from "../../utils/messages";
import "./App.css";

type SaveStatus =
  | { type: "idle"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

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

      const response = (await browser.tabs.sendMessage(tab.id, {
        type: "noesis:save-entry",
      })) as SaveEntryResponse | undefined;

      if (!response?.ok) {
        setStatus({
          type: "error",
          message: response?.error ?? "Open a Stanford Encyclopedia entry first.",
        });
        return;
      }

      setStatus({
        type: "success",
        message: `Saved “${response.entry.title}”.`,
      });
    } catch {
      setStatus({
        type: "error",
        message: "Open a Stanford Encyclopedia entry first.",
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
