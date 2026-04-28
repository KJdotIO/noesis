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
      <section className="hero">
        <p className="eyebrow">Noesis Library</p>
        <h1>Your SEP reading trail, synced from the extension.</h1>
        <p>
          Review saved entries and recent highlights without replacing the
          canonical Stanford Encyclopedia of Philosophy reading experience.
        </p>
      </section>

      {state.type === "missing-config" ? (
        <section className="panel">
          <h2>Configuration needed</h2>
          <p>Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to use the web library.</p>
        </section>
      ) : state.type === "ready" ? (
        <section className="dashboard">
          <div className="toolbar">
            <span>Signed in as {state.user.email}</span>
            <button type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
          <section className="panel">
            <h2>Saved entries</h2>
            {state.entries.length === 0 ? (
              <p>No synced entries yet.</p>
            ) : (
              <ul className="entry-list">
                {state.entries.map((entry) => (
                  <li key={entry.entry_slug}>
                    <a href={entry.source_url}>{entry.title}</a>
                    <span>{new Date(entry.saved_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel">
            <h2>Recent highlights</h2>
            {state.highlights.length === 0 ? (
              <p>No synced highlights yet.</p>
            ) : (
              <ul className="highlight-list">
                {state.highlights.map((highlight) => (
                  <li key={highlight.id}>
                    <q>{highlight.quote}</q>
                    {highlight.note ? <p>{highlight.note}</p> : null}
                    <a href={highlight.source_url}>{highlight.entry_slug}</a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>
      ) : state.type === "loading" ? (
        <section className="panel">
          <p>Loading library...</p>
        </section>
      ) : (
        <section className="panel auth">
          <h2>Sign in</h2>
          <input
            type="email"
            placeholder="you@example.com"
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
              <input
                inputMode="numeric"
                placeholder="Verification code"
                value={state.token}
                onChange={(event) =>
                  setState({ ...state, token: event.target.value })
                }
              />
              <button type="button" onClick={verifyCode}>
                Verify code
              </button>
            </>
          ) : null}
          <p>{state.message}</p>
        </section>
      )}
    </main>
  );
}

export default App;
