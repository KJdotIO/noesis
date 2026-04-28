import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { GuestHighlight, GuestState, HighlightColor } from "./guest-storage";
import { writeGuestState } from "./guest-storage";

export type SyncSummary = {
  savedEntries: number;
  readingPositions: number;
  highlights: number;
  pulledEntries?: number;
  pulledReadingPositions?: number;
  pulledHighlights?: number;
};

type RemoteSavedEntry = {
  entry_slug: string;
  title: string;
  source_url: string;
  saved_at: string;
};

type RemoteReadingPosition = {
  entry_slug: string;
  source_url: string;
  scroll_y: number;
  scroll_ratio: number;
  updated_at: string;
};

type RemoteHighlight = {
  id: string;
  local_id: string | null;
  entry_slug: string;
  source_url: string;
  quote: string;
  note: string | null;
  color: string | null;
  text_position: number | null;
  occurrence_index: number | null;
  prefix: string | null;
  suffix: string | null;
  created_at: string;
  updated_at: string;
};

const highlightColors = new Set(["yellow", "green", "blue", "pink", "purple"]);

function toHighlightColor(color: string | null): HighlightColor | undefined {
  return color && highlightColors.has(color) ? (color as HighlightColor) : undefined;
}

export async function syncGuestStateToSupabase(
  supabase: SupabaseClient,
  user: User,
  state: GuestState,
): Promise<SyncSummary> {
  const savedEntries = Object.values(state.savedEntries);
  const readingPositions = Object.values(state.readingPositions);
  const highlights = Object.values(state.highlights).flat();

  if (savedEntries.length > 0) {
    const { error } = await supabase.from("user_saved_entries").upsert(
      savedEntries.map((entry) => ({
        user_id: user.id,
        entry_slug: entry.slug,
        title: entry.title,
        source_url: entry.url,
        saved_at: entry.savedAt,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,entry_slug" },
    );

    if (error) {
      throw error;
    }
  }

  if (readingPositions.length > 0) {
    const { error } = await supabase.from("user_reading_positions").upsert(
      readingPositions.map((position) => ({
        user_id: user.id,
        entry_slug: position.slug,
        source_url: position.url,
        scroll_y: position.scrollY,
        scroll_ratio: position.scrollRatio,
        updated_at: position.updatedAt,
      })),
      { onConflict: "user_id,entry_slug" },
    );

    if (error) {
      throw error;
    }
  }

  if (highlights.length > 0) {
    const { error } = await supabase.from("user_highlights").upsert(
      highlights.map((highlight) => ({
        user_id: user.id,
        local_id: highlight.id,
        entry_slug: highlight.slug,
        source_url: highlight.url,
        quote: highlight.quote,
        note: highlight.note ?? null,
        color: highlight.color ?? null,
        text_position: highlight.textPosition ?? null,
        occurrence_index: highlight.occurrenceIndex ?? null,
        prefix: highlight.prefix ?? null,
        suffix: highlight.suffix ?? null,
        created_at: highlight.createdAt,
        updated_at: highlight.updatedAt,
      })),
      { onConflict: "user_id,local_id" },
    );

    if (error) {
      throw error;
    }
  }

  return {
    savedEntries: savedEntries.length,
    readingPositions: readingPositions.length,
    highlights: highlights.length,
  };
}

export async function pullSupabaseStateIntoGuestState(
  supabase: SupabaseClient,
  state: GuestState,
): Promise<GuestState & { summary: SyncSummary }> {
  const [entriesResult, positionsResult, highlightsResult] = await Promise.all([
    supabase
      .from("user_saved_entries")
      .select("entry_slug,title,source_url,saved_at"),
    supabase
      .from("user_reading_positions")
      .select("entry_slug,source_url,scroll_y,scroll_ratio,updated_at"),
    supabase
      .from("user_highlights")
      .select(
        "id,local_id,entry_slug,source_url,quote,note,color,text_position,occurrence_index,prefix,suffix,created_at,updated_at",
      ),
  ]);

  if (entriesResult.error) {
    throw entriesResult.error;
  }
  if (positionsResult.error) {
    throw positionsResult.error;
  }
  if (highlightsResult.error) {
    throw highlightsResult.error;
  }

  const nextState: GuestState = {
    ...state,
    savedEntries: { ...state.savedEntries },
    readingPositions: { ...state.readingPositions },
    highlights: { ...state.highlights },
  };

  for (const entry of (entriesResult.data ?? []) as RemoteSavedEntry[]) {
    nextState.savedEntries[entry.entry_slug] = {
      slug: entry.entry_slug,
      title: entry.title,
      url: entry.source_url,
      savedAt: entry.saved_at,
    };
  }

  for (const position of (positionsResult.data ?? []) as RemoteReadingPosition[]) {
    nextState.readingPositions[position.entry_slug] = {
      slug: position.entry_slug,
      url: position.source_url,
      scrollY: position.scroll_y,
      scrollRatio: position.scroll_ratio,
      updatedAt: position.updated_at,
    };
  }

  for (const highlight of (highlightsResult.data ?? []) as RemoteHighlight[]) {
    const localHighlight: GuestHighlight = {
      id: highlight.local_id ?? highlight.id,
      slug: highlight.entry_slug,
      quote: highlight.quote,
      note: highlight.note ?? undefined,
      url: highlight.source_url,
      color: toHighlightColor(highlight.color),
      textPosition: highlight.text_position ?? undefined,
      occurrenceIndex: highlight.occurrence_index ?? undefined,
      prefix: highlight.prefix ?? undefined,
      suffix: highlight.suffix ?? undefined,
      createdAt: highlight.created_at,
      updatedAt: highlight.updated_at,
    };
    const existing = nextState.highlights[highlight.entry_slug] ?? [];
    nextState.highlights[highlight.entry_slug] = [
      ...existing.filter((item) => item.id !== localHighlight.id),
      localHighlight,
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  await writeGuestState(nextState);

  return {
    ...nextState,
    summary: {
      savedEntries: 0,
      readingPositions: 0,
      highlights: 0,
      pulledEntries: entriesResult.data?.length ?? 0,
      pulledReadingPositions: positionsResult.data?.length ?? 0,
      pulledHighlights: highlightsResult.data?.length ?? 0,
    },
  };
}

export async function syncGuestStateWithSupabase(
  supabase: SupabaseClient,
  user: User,
  state: GuestState,
): Promise<SyncSummary> {
  const pushed = await syncGuestStateToSupabase(supabase, user, state);
  const pulled = await pullSupabaseStateIntoGuestState(supabase, state);

  return {
    ...pushed,
    pulledEntries: pulled.summary.pulledEntries,
    pulledReadingPositions: pulled.summary.pulledReadingPositions,
    pulledHighlights: pulled.summary.pulledHighlights,
  };
}
