import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient, hasSupabaseConfig } from "./supabase";
import "./style.css";

type SavedEntry = {
  entry_slug: string;
  title: string;
  source_url: string;
  saved_at: string;
};

type Highlight = {
  id: string;
  entry_slug: string;
  quote: string;
  note: string | null;
  color: string | null;
  source_url: string;
  updated_at: string;
};

type LibraryState =
  | { type: "missing-config" }
  | { type: "signed-out"; email: string; message: string }
  | { type: "code-sent"; email: string; token: string; message: string }
  | { type: "loading"; user: User }
  | { type: "ready"; user: User; entries: SavedEntry[]; highlights: Highlight[] }
  | { type: "error"; email: string; message: string };

function App() {
  const [state, setState] = useState<LibraryState>(
    hasSupabaseConfig()
      ? {
          type: "signed-out",
          email: "",
          message: "Sign in to view your synced Noesis library.",
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

    const email = state.email.trim();
    if (!email) {
      setState({
        type: "error",
        email,
        message: "Enter an email address first.",
      });
      return;
    }

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
      message: "Check your email for the verification code.",
    });
  }

  async function verifyCode() {
    if (!supabase || state.type !== "code-sent") {
      return;
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email: state.email,
      token: state.token.trim(),
      type: "email",
    });

    if (error || !data.user) {
      setState({
        ...state,
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
          description="Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to use the web library."
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
              Sign in with the same email you used in the extension to review
              synced SEP entries and highlights.
            </p>
          </div>
          <form
            className="panel auth"
            onSubmit={(event) => {
              event.preventDefault();
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
              onChange={(event) =>
                setState({
                  type: "signed-out",
                  email: event.target.value,
                  message: "Sign in to view your synced Noesis library.",
                })
              }
            />
            <button type="button" onClick={sendCode}>
              Send verification code
            </button>
            {state.type === "code-sent" ? (
              <>
                <label htmlFor="token">Verification code</label>
                <input
                  id="token"
                  inputMode="numeric"
                  placeholder="123456"
                  value={state.token}
                  onChange={(event) =>
                    setState({ ...state, token: event.target.value })
                  }
                />
                <button type="submit">Verify code</button>
              </>
            ) : null}
            <p className={state.type === "error" ? "form-message error" : "form-message"}>
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

        <div className="dashboard">
          <section className="panel">
            <div className="section-heading">
              <h2>Saved entries</h2>
              <span>{entries.length} total</span>
            </div>
            {entries.length === 0 ? (
              <EmptyState
                title="No entries synced yet"
                description="Save an SEP entry from the extension, then sync local data from the popup."
              />
            ) : (
              <ul className="entry-list">
                {entries.map((entry) => (
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
              <span>{highlights.length} total</span>
            </div>
            {highlights.length === 0 ? (
              <EmptyState
                title="No highlights synced yet"
                description="Highlight text in a SEP entry, add an optional note, and sync from the extension."
              />
            ) : (
              <ul className="highlight-list">
                {highlights.map((highlight) => (
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
