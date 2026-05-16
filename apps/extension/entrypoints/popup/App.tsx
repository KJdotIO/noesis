import { useEffect, useState } from "react";
import {
  deleteGuestHighlight,
  readGuestState,
  saveGuestEntry,
  updateGuestSettings,
} from "../../utils/guest-storage";
import type { GuestHighlight, HighlightColor } from "../../utils/guest-storage";
import { deriveSepSlug, type SepEntryContext } from "../../utils/sep";
import { getSupabaseClient, hasSupabaseConfig } from "../../utils/supabase";
import { syncGuestStateWithSupabase, type SyncSummary } from "../../utils/sync";
import type { NoesisMessage } from "../../utils/messages";
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
      highlights: GuestHighlight[];
      highlightsVisible: boolean;
      defaultHighlightColor: HighlightColor;
      progress: number | null;
    };

type AuthState =
  | { type: "missing-config" }
  | { type: "sending"; email: string; message: string }
  | {
      type: "signed-in";
      email: string;
      message: string;
      syncSummary?: SyncSummary;
    }
  | { type: "signed-out"; email: string; message: string }
  | { type: "sent"; email: string; token: string; message: string }
  | { type: "verifying"; email: string; token: string; message: string }
  | { type: "syncing"; email: string; message: string }
  | { type: "error"; email: string; message: string };

async function getEntryFromTab(
  tab: Browser.tabs.Tab,
): Promise<SepEntryContext> {
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
        document.title
          .replace(" (Stanford Encyclopedia of Philosophy)", "")
          .trim(),
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

function isIgnorableSendMessageError(error: unknown): boolean {
  let message = "";
  if (error instanceof Error || error instanceof DOMException) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  }
  const normalised = message.toLowerCase();

  return (
    normalised.includes("receiving end does not exist") ||
    normalised.includes("message port closed")
  );
}

async function sendMessageToTab(
  tabId: number,
  message: NoesisMessage,
): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, message);
  } catch (error) {
    if (isIgnorableSendMessageError(error)) {
      return;
    }

    console.warn("[noesis] tabs.sendMessage failed", error);
    throw error;
  }
}

async function refreshCurrentTabHighlights(): Promise<void> {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id) {
    return;
  }

  await activatePageTools(tab.id);
  await sendMessageToTab(tab.id, { type: "noesis:refresh-highlights" });
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
  const [authState, setAuthState] = useState<AuthState>(
    hasSupabaseConfig()
      ? {
          type: "signed-out",
          email: "",
          message:
            "Optional backup. Your local library stays on this browser unless you sync it.",
        }
      : { type: "missing-config" },
  );

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
        highlights: guestState.highlights[entry.slug] ?? [],
        highlightsVisible: guestState.settings.highlightsVisible,
        defaultHighlightColor: guestState.settings.defaultHighlightColor,
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
    void loadAuthState();
  }, []);

  async function loadAuthState() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setAuthState({ type: "missing-config" });
      return;
    }

    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user?.email) {
      return;
    }

    setAuthState({
      type: "signed-in",
      email: user.email,
      message: "Signed in. Your local library is ready to sync.",
    });
  }

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

  async function toggleHighlightsVisible() {
    if (!pageState.supported) {
      return;
    }

    const nextVisible = !pageState.highlightsVisible;
    const settings = await updateGuestSettings({
      highlightsVisible: nextVisible,
    });
    setPageState({
      ...pageState,
      highlightsVisible: settings.highlightsVisible,
    });

    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab?.id) {
      try {
        await activatePageTools(tab.id);
        await sendMessageToTab(tab.id, {
          type: "noesis:set-highlights-visible",
          visible: settings.highlightsVisible,
        });
      } catch (error) {
        setStatus({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not update this tab.",
        });
      }
    }
  }

  async function deleteHighlight(highlight: GuestHighlight) {
    if (!pageState.supported) {
      return;
    }

    await deleteGuestHighlight(pageState.entry.slug, highlight.id);
    await loadPageState();
    setStatus({ type: "success", message: "Highlight deleted." });
  }

  async function jumpToHighlight(highlight: GuestHighlight) {
    if (!pageState.supported) {
      return;
    }

    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      setStatus({ type: "error", message: "No active tab found." });
      return;
    }

    await activatePageTools(tab.id);
    try {
      await sendMessageToTab(tab.id, {
        type: "noesis:scroll-to-highlight",
        highlightId: highlight.id,
      });
      setStatus({ type: "idle", message: "Jumped to highlight." });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not jump to highlight.",
      });
    }
  }

  async function sendSignInEmail() {
    if (authState.type === "missing-config") {
      return;
    }

    const email = authState.email.trim();
    if (!email) {
      setAuthState({
        type: "error",
        email,
        message: "Enter an email address first.",
      });
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setAuthState({ type: "missing-config" });
      return;
    }

    setAuthState({
      type: "sending",
      email,
      message: `Sending sign-in email to ${email}...`,
    });

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      setAuthState({ type: "error", email, message: error.message });
      return;
    }

    setAuthState({
      type: "sent",
      email,
      token: "",
      message:
        "Email sent. Paste the six-digit code from your inbox to connect this browser.",
    });
  }

  async function verifyEmailCode() {
    if (authState.type !== "sent" && authState.type !== "verifying") {
      return;
    }

    const token = authState.token.trim();
    if (!token) {
      setAuthState({
        ...authState,
        message: "Enter the verification code from your email.",
      });
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setAuthState({ type: "missing-config" });
      return;
    }

    const pendingState = authState;
    setAuthState({
      type: "verifying",
      email: pendingState.email,
      token,
      message: "Checking that code...",
    });

    const { data, error } = await supabase.auth.verifyOtp({
      email: pendingState.email,
      token,
      type: "email",
    });

    if (error || !data.user?.email) {
      setAuthState({
        type: "sent",
        email: pendingState.email,
        token,
        message: error?.message ?? "Could not verify code.",
      });
      return;
    }

    setAuthState({
      type: "signed-in",
      email: data.user.email,
      message: "Verified. You can sync this browser's local library now.",
    });
  }

  async function syncLocalData() {
    if (authState.type !== "signed-in") {
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setAuthState({ type: "missing-config" });
      return;
    }

    const email = authState.email;
    setAuthState({
      type: "syncing",
      email,
      message: "Syncing local library to your account...",
    });

    const [{ data }, guestState] = await Promise.all([
      supabase.auth.getUser(),
      readGuestState(),
    ]);

    if (!data.user) {
      setAuthState({
        type: "signed-out",
        email,
        message: "Session expired. Send a fresh sign-in email.",
      });
      return;
    }

    try {
      const syncSummary = await syncGuestStateWithSupabase(
        supabase,
        data.user,
        guestState,
      );
      await loadPageState();
      try {
        await refreshCurrentTabHighlights();
      } catch (error) {
        console.warn("[noesis] could not refresh page highlights", error);
      }
      setAuthState({
        type: "signed-in",
        email: data.user.email ?? email,
        syncSummary,
        message: "Account and local library are in sync.",
      });
    } catch (error) {
      setAuthState({
        type: "error",
        email,
        message: error instanceof Error ? error.message : "Sync failed.",
      });
    }
  }

  async function signOut() {
    const supabase = getSupabaseClient();
    await supabase?.auth.signOut();
    setAuthState({
      type: "signed-out",
      email: "",
      message: "Signed out. Local guest data remains on this browser.",
    });
  }

  return (
    <main className="popup">
      <p className="eyebrow">Noesis</p>
      <h1>{pageState.supported ? pageState.entry.title : "SEP companion"}</h1>
      {pageState.supported ? (
        <section className="summary">
          <span>{pageState.saved ? "Saved" : "Not saved yet"}</span>
          <span>
            {pageState.highlights.length}{" "}
            {pageState.highlights.length === 1 ? "highlight" : "highlights"}
          </span>
          <span>
            {pageState.progress === null
              ? "No progress yet"
              : `${pageState.progress}% read`}
          </span>
        </section>
      ) : (
        <p className="description">{pageState.message}</p>
      )}
      {pageState.supported ? (
        <button
          className="secondary-button"
          type="button"
          onClick={toggleHighlightsVisible}
        >
          {pageState.highlightsVisible ? "Hide highlights" : "Show highlights"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={saveCurrentEntry}
        disabled={!pageState.supported}
      >
        {pageState.supported && pageState.saved
          ? "Save again"
          : "Save current entry"}
      </button>
      {pageState.supported && pageState.highlights.length > 0 ? (
        <section className="highlights">
          <h2>Saved highlights</h2>
          <ul>
            {pageState.highlights.map((highlight) => (
              <li key={highlight.id}>
                <q>{highlight.quote}</q>
                {highlight.note ? <p>{highlight.note}</p> : null}
                <div className="highlight-actions">
                  <button
                    type="button"
                    onClick={() => jumpToHighlight(highlight)}
                  >
                    Jump
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteHighlight(highlight)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="auth-panel">
        <h2>Optional backup</h2>
        {authState.type === "missing-config" ? (
          <p>Sync isn't configured in this build.</p>
        ) : authState.type === "signed-in" || authState.type === "syncing" ? (
          <>
            <p>{authState.message}</p>
            {authState.type === "signed-in" && authState.syncSummary ? (
              <p>
                Pushed {authState.syncSummary.savedEntries} entries,{" "}
                {authState.syncSummary.highlights} account highlights. Pulled{" "}
                {authState.syncSummary.pulledEntries ?? 0} entries and{" "}
                {authState.syncSummary.pulledHighlights ?? 0} account
                highlights. This page now shows its own highlights above.
              </p>
            ) : null}
            <button
              className="secondary-button"
              type="button"
              disabled={authState.type === "syncing"}
              onClick={syncLocalData}
            >
              {authState.type === "syncing"
                ? "Syncing..."
                : "Sync account data"}
            </button>
            <button
              className="text-button"
              type="button"
              disabled={authState.type === "syncing"}
              onClick={signOut}
            >
              Sign out {authState.email}
            </button>
          </>
        ) : (
          <>
            <input
              type="email"
              placeholder="you@example.com"
              value={authState.email}
              disabled={
                authState.type === "sending" || authState.type === "verifying"
              }
              onChange={(event) =>
                setAuthState({
                  type: "signed-out",
                  email: event.target.value,
                  message:
                    "Optional backup. Your local library stays on this browser unless you sync it.",
                })
              }
            />
            <button
              className="secondary-button"
              type="button"
              disabled={
                authState.type === "sending" || authState.type === "verifying"
              }
              onClick={sendSignInEmail}
            >
              {authState.type === "sending"
                ? "Sending..."
                : "Send sign-in email"}
            </button>
            {authState.type === "sent" || authState.type === "verifying" ? (
              <>
                <input
                  inputMode="numeric"
                  placeholder="Six-digit code"
                  value={authState.token}
                  disabled={authState.type === "verifying"}
                  onChange={(event) =>
                    setAuthState({
                      ...authState,
                      token: event.target.value,
                    })
                  }
                />
                <button
                  className="secondary-button"
                  type="button"
                  disabled={authState.type === "verifying"}
                  onClick={verifyEmailCode}
                >
                  {authState.type === "verifying"
                    ? "Verifying..."
                    : "Verify code"}
                </button>
                <p className="auth-hint">
                  If your email only shows a magic link, the Supabase email
                  template needs to include the six-digit token.
                </p>
              </>
            ) : null}
            <p>{authState.message}</p>
          </>
        )}
      </section>
      <p className={`status status-${status.type}`}>{status.message}</p>
    </main>
  );
}

export default App;
