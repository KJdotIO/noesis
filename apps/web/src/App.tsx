import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { UserHighlightSyncRow, UserSavedEntrySyncRow } from "noesis-types";
import { getSupabaseClient, hasSupabaseConfig } from "./supabase";
import "./style.css";

type SavedEntry = UserSavedEntrySyncRow;
type Highlight = Pick<
  UserHighlightSyncRow,
  "id" | "entry_slug" | "quote" | "note" | "color" | "source_url" | "updated_at"
>;

type LibraryState =
  | { type: "missing-config" }
  | { type: "signed-out"; email: string; message: string }
  | { type: "sending"; email: string; message: string }
  | { type: "code-sent"; email: string; token: string; message: string }
  | { type: "verifying"; email: string; token: string; message: string }
  | { type: "loading"; user: User }
  | {
      type: "ready";
      user: User;
      entries: SavedEntry[];
      highlights: Highlight[];
    }
  | { type: "error"; email: string; message: string };

function App() {
  const [state, setState] = useState<LibraryState>(
    hasSupabaseConfig()
      ? {
          type: "signed-out",
          email: "",
          message: "Send a sign-in email to view your synced Noesis library.",
        }
      : { type: "missing-config" },
  );

  const supabase = useMemo(getSupabaseClient, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        void loadLibrary(data.user);
      }
    });
  }, [supabase]);

  async function loadLibrary(user: User) {
    if (!supabase) {
      return;
    }

    setState({ type: "loading", user });

    const [entriesResult, highlightsResult] = await Promise.all([
      supabase
        .from("user_saved_entries")
        .select("entry_slug,title,source_url,saved_at")
        .order("saved_at", { ascending: false }),
      supabase
        .from("user_highlights")
        .select("id,entry_slug,quote,note,color,source_url,updated_at")
        .order("updated_at", { ascending: false }),
    ]);

    if (entriesResult.error || highlightsResult.error) {
      setState({
        type: "error",
        email: user.email ?? "",
        message:
          entriesResult.error?.message ??
          highlightsResult.error?.message ??
          "Could not load library.",
      });
      return;
    }

    setState({
      type: "ready",
      user,
      entries: entriesResult.data ?? [],
      highlights: highlightsResult.data ?? [],
    });
  }

  async function sendCode() {
    if (!supabase || !("email" in state)) {
      return;
    }
    if (state.type === "sending" || state.type === "verifying") {
      return;
    }

    const email = state.email.trim();
    if (!email) {
      setState({
        type: "error",
        email,
        message: "Enter an email address first.",
      });
      return;
    }

    setState({
      type: "sending",
      email,
      message: `Sending sign-in email to ${email}...`,
    });

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    if (error) {
      setState({ type: "error", email, message: error.message });
      return;
    }

    setState({
      type: "code-sent",
      email,
      token: "",
      message:
        "Email sent. Paste the six-digit code from your inbox to open your library.",
    });
  }

  async function verifyCode() {
    if (
      !supabase ||
      (state.type !== "code-sent" && state.type !== "verifying")
    ) {
      return;
    }

    const token = state.token.trim();
    if (!token) {
      setState({
        ...state,
        message: "Enter the six-digit code from your email.",
      });
      return;
    }

    const pendingState = state;
    setState({
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

    if (error || !data.user) {
      setState({
        type: "code-sent",
        email: pendingState.email,
        token,
        message: error?.message ?? "Could not verify code.",
      });
      return;
    }

    await loadLibrary(data.user);
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setState({
      type: "signed-out",
      email: "",
      message: "Signed out. Sign in again to view synced data.",
    });
  }

  return (
    <main className="shell">
      {state.type === "missing-config" ? (
        <CenteredPanel
          eyebrow="Noesis Library"
          title="Configuration needed"
          description="Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to use the web library."
        />
      ) : state.type === "ready" ? (
        <LibraryView
          entries={state.entries}
          highlights={state.highlights}
          userEmail={state.user.email ?? "reader"}
          onSignOut={signOut}
        />
      ) : state.type === "loading" ? (
        <LoadingLibrary userEmail={state.user.email ?? "reader"} />
      ) : (
        <section className="auth-layout">
          <div className="auth-copy">
            <p className="eyebrow">Noesis Library</p>
            <h1>Return to your reading trail.</h1>
            <p>
              Use the same email you used in the extension to review synced
              SEP entries and highlights.
            </p>
          </div>
          <form
            className="panel auth"
            onSubmit={(event) => {
              event.preventDefault();
              if (state.type === "verifying") {
                return;
              }
              if (state.type === "code-sent") {
                void verifyCode();
                return;
              }
              void sendCode();
            }}
          >
            <h2>Sign in</h2>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              placeholder="reader@example.com"
              value={state.email}
              disabled={state.type === "sending" || state.type === "verifying"}
              onChange={(event) =>
                setState({
                  type: "signed-out",
                  email: event.target.value,
                  message:
                    "Send a sign-in email to view your synced Noesis library.",
                })
              }
            />
            <button
              type="button"
              disabled={state.type === "sending" || state.type === "verifying"}
              onClick={sendCode}
            >
              {state.type === "sending" ? "Sending..." : "Send sign-in email"}
            </button>
            {state.type === "code-sent" || state.type === "verifying" ? (
              <>
                <label htmlFor="token">Six-digit code</label>
                <input
                  id="token"
                  inputMode="numeric"
                  placeholder="123456"
                  value={state.token}
                  disabled={state.type === "verifying"}
                  onChange={(event) =>
                    setState({ ...state, token: event.target.value })
                  }
                />
                <button type="submit" disabled={state.type === "verifying"}>
                  {state.type === "verifying" ? "Verifying..." : "Verify code"}
                </button>
                <p className="form-message">
                  If your email only shows a magic link, the Supabase email
                  template needs to include the six-digit token.
                </p>
              </>
            ) : null}
            <p
              className={
                state.type === "error" ? "form-message error" : "form-message"
              }
            >
              {state.message}
            </p>
          </form>
        </section>
      )}
    </main>
  );
}

type LibraryViewProps = {
  entries: SavedEntry[];
  highlights: Highlight[];
  userEmail: string;
  onSignOut: () => void;
};

function LibraryView({
  entries,
  highlights,
  userEmail,
  onSignOut,
}: LibraryViewProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleEntries = normalizedQuery
    ? entries.filter((entry) =>
        [entry.title, entry.entry_slug].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        ),
      )
    : entries;
  const visibleHighlights = normalizedQuery
    ? highlights.filter((highlight) =>
        [highlight.quote, highlight.note ?? "", highlight.entry_slug].some(
          (value) => value.toLowerCase().includes(normalizedQuery),
        ),
      )
    : highlights;

  return (
    <section className="library-layout">
      <aside className="library-rail">
        <a className="brand-mark" href="/">
          <span aria-hidden="true">N</span>
          <strong>Noesis</strong>
        </a>
        <div className="rail-section">
          <p className="eyebrow">Account</p>
          <p className="account-email">{userEmail}</p>
          <button className="quiet-button" type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
        <div className="rail-stats" aria-label="Library summary">
          <div>
            <strong>{entries.length}</strong>
            <span>{entries.length === 1 ? "entry" : "entries"}</span>
          </div>
          <div>
            <strong>{highlights.length}</strong>
            <span>{highlights.length === 1 ? "highlight" : "highlights"}</span>
          </div>
        </div>
        <p className="sync-note">
          Synced from the Noesis browser extension. SEP remains the canonical
          reading source.
        </p>
      </aside>

      <div className="library-main">
        <header className="hero">
          <p className="eyebrow">Noesis Library</p>
          <h1>Your SEP reading trail.</h1>
          <p>
            Saved entries and highlight notes collected without interrupting the
            original Stanford Encyclopedia of Philosophy reading flow.
          </p>
        </header>

        <div className="library-search">
          <label htmlFor="library-search">Search library</label>
          <input
            id="library-search"
            type="search"
            placeholder="Search entries, highlights, or notes"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="dashboard">
          <section className="panel">
            <div className="section-heading">
              <h2>Saved entries</h2>
              <span>{visibleEntries.length} shown</span>
            </div>
            {visibleEntries.length === 0 ? (
              <EmptyState
                title={query ? "No matching entries" : "No entries synced yet"}
                description={
                  query
                    ? "Try a different title, slug, or note phrase."
                    : "Save an SEP entry from the extension, then sync account data from the popup."
                }
              />
            ) : (
              <ul className="entry-list">
                {visibleEntries.map((entry) => (
                  <li key={entry.entry_slug}>
                    <a href={entry.source_url}>{entry.title}</a>
                    <span>{new Date(entry.saved_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel">
            <div className="section-heading">
              <h2>Recent highlights</h2>
              <span>{visibleHighlights.length} shown</span>
            </div>
            {visibleHighlights.length === 0 ? (
              <EmptyState
                title={
                  query ? "No matching highlights" : "No highlights synced yet"
                }
                description={
                  query
                    ? "Search includes highlight text, notes, and entry slugs."
                    : "Highlight text in a SEP entry, add an optional note, and sync from the extension."
                }
              />
            ) : (
              <ul className="highlight-list">
                {visibleHighlights.map((highlight) => (
                  <li key={highlight.id}>
                    <q>{highlight.quote}</q>
                    {highlight.note ? <p>{highlight.note}</p> : null}
                    <a href={highlight.source_url}>{highlight.entry_slug}</a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function LoadingLibrary({ userEmail }: { userEmail: string }) {
  return (
    <section className="library-layout">
      <aside className="library-rail">
        <a className="brand-mark" href="/">
          <span aria-hidden="true">N</span>
          <strong>Noesis</strong>
        </a>
        <div className="rail-section">
          <p className="eyebrow">Account</p>
          <p className="account-email">{userEmail}</p>
        </div>
      </aside>
      <div className="library-main">
        <header className="hero">
          <p className="eyebrow">Noesis Library</p>
          <h1>Loading your reading trail.</h1>
        </header>
        <div className="panel skeleton-stack" aria-label="Loading library">
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}

function CenteredPanel({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="centered-panel">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}

export default App;
