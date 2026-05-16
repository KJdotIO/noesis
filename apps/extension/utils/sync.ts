import type {
  PostgrestError,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";
import type {
  UserHighlightSyncRow,
  UserReadingPositionSyncRow,
  UserSavedEntrySyncRow,
} from "noesis-types";
import type {
  DeletedGuestHighlight,
  GuestHighlight,
  GuestState,
  HighlightColor,
} from "./guest-storage";
import { readGuestState, updateGuestState } from "./guest-storage";

export type SyncSummary = {
  savedEntries: number;
  readingPositions: number;
  highlights: number;
  deletedHighlights?: number;
  pulledEntries?: number;
  pulledReadingPositions?: number;
  pulledHighlights?: number;
};

export type RemoteSavedEntry = UserSavedEntrySyncRow;
export type RemoteReadingPosition = UserReadingPositionSyncRow;
export type RemoteHighlight = UserHighlightSyncRow;

type SyncedHighlightIdentity = {
  id: string;
  local_id: string;
};

function throwIfError(error: PostgrestError | null): void {
  if (error) {
    throw error;
  }
}

const highlightColors = {
  yellow: true,
  green: true,
  blue: true,
  pink: true,
  purple: true,
} satisfies Record<HighlightColor, true>;

function isHighlightColor(value: string): value is HighlightColor {
  return value in highlightColors;
}

function toHighlightColor(color: string | null): HighlightColor | undefined {
  if (!color) {
    return undefined;
  }

  return isHighlightColor(color) ? color : undefined;
}

function getDeletedHighlights(state: GuestState): DeletedGuestHighlight[] {
  return Object.values(state.deletedHighlights ?? {});
}

async function syncDeletedHighlightsToSupabase(
  supabase: SupabaseClient,
  user: User,
  state: GuestState,
): Promise<number> {
  const deletedHighlights = getDeletedHighlights(state);
  const localIds = deletedHighlights.map((highlight) => highlight.localId);
  const remoteIds = deletedHighlights
    .map((highlight) => highlight.remoteId)
    .filter((id): id is string => Boolean(id));

  if (deletedHighlights.length === 0) {
    return 0;
  }

  if (localIds.length > 0) {
    const { error } = await supabase
      .from("user_highlights")
      .delete()
      .eq("user_id", user.id)
      .in("local_id", localIds);

    throwIfError(error);
  }

  if (remoteIds.length > 0) {
    const { error } = await supabase
      .from("user_highlights")
      .delete()
      .eq("user_id", user.id)
      .in("id", remoteIds);

    throwIfError(error);
  }

  await updateGuestState((latestState) => {
    for (const highlight of deletedHighlights) {
      delete latestState.deletedHighlights[highlight.localId];
    }
  });

  return deletedHighlights.length;
}

async function storeRemoteHighlightIds(
  identities: SyncedHighlightIdentity[] | null,
): Promise<void> {
  if (!identities || identities.length === 0) {
    return;
  }

  const remoteIdByLocalId = new Map(
    identities.map((identity) => [identity.local_id, identity.id]),
  );
  await updateGuestState((latestState) => {
    for (const highlights of Object.values(latestState.highlights)) {
      for (const highlight of highlights) {
        const remoteId = remoteIdByLocalId.get(highlight.id);
        if (remoteId && highlight.remoteId !== remoteId) {
          highlight.remoteId = remoteId;
        }
      }
    }
  });
}

function isRemoteNewer(
  remoteUpdatedAt: string | null | undefined,
  localUpdatedAt: string | null | undefined,
): boolean {
  if (!localUpdatedAt) {
    return true;
  }
  if (!remoteUpdatedAt) {
    return false;
  }

  return (
    new Date(remoteUpdatedAt).getTime() > new Date(localUpdatedAt).getTime()
  );
}

export function mergeRemoteSavedEntries(
  state: GuestState,
  entries: RemoteSavedEntry[],
): void {
  for (const entry of entries) {
    const localEntry = state.savedEntries[entry.entry_slug];
    if (localEntry && !isRemoteNewer(entry.saved_at, localEntry.savedAt)) {
      continue;
    }

    state.savedEntries[entry.entry_slug] = {
      slug: entry.entry_slug,
      title: entry.title,
      url: entry.source_url,
      savedAt: entry.saved_at,
    };
  }
}

export function mergeRemoteReadingPositions(
  state: GuestState,
  positions: RemoteReadingPosition[],
): void {
  for (const position of positions) {
    const localPosition = state.readingPositions[position.entry_slug];
    if (
      localPosition &&
      !isRemoteNewer(position.updated_at, localPosition.updatedAt)
    ) {
      continue;
    }

    state.readingPositions[position.entry_slug] = {
      slug: position.entry_slug,
      url: position.source_url,
      scrollY: position.scroll_y,
      scrollRatio: position.scroll_ratio,
      updatedAt: position.updated_at,
    };
  }
}

export function toLocalHighlight(highlight: RemoteHighlight): GuestHighlight {
  return {
    id: highlight.local_id ?? highlight.id,
    remoteId: highlight.id,
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
}

export function mergeRemoteHighlights(
  state: GuestState,
  highlights: RemoteHighlight[],
): void {
  for (const highlight of highlights) {
    const localHighlight = toLocalHighlight(highlight);
    if (state.deletedHighlights[localHighlight.id]) {
      continue;
    }

    const existing = state.highlights[highlight.entry_slug] ?? [];
    const existingHighlight = existing.find(
      (item) => item.id === localHighlight.id,
    );
    if (
      existingHighlight &&
      !isRemoteNewer(localHighlight.updatedAt, existingHighlight.updatedAt)
    ) {
      if (localHighlight.remoteId && !existingHighlight.remoteId) {
        existingHighlight.remoteId = localHighlight.remoteId;
      }
      continue;
    }

    state.highlights[highlight.entry_slug] = [
      ...existing.filter((item) => item.id !== localHighlight.id),
      localHighlight,
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}

async function syncGuestStateToSupabase(
  supabase: SupabaseClient,
  user: User,
  state: GuestState,
): Promise<SyncSummary> {
  const deletedHighlights = await syncDeletedHighlightsToSupabase(
    supabase,
    user,
    state,
  );
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

    throwIfError(error);
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

    throwIfError(error);
  }

  if (highlights.length > 0) {
    const { data, error } = await supabase
      .from("user_highlights")
      .upsert(
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
      )
      .select("id,local_id")
      .overrideTypes<SyncedHighlightIdentity[], { merge: false }>();

    throwIfError(error);

    await storeRemoteHighlightIds(data);
  }

  return {
    savedEntries: savedEntries.length,
    readingPositions: readingPositions.length,
    highlights: highlights.length,
    deletedHighlights,
  };
}

async function pullSupabaseStateIntoGuestState(
  supabase: SupabaseClient,
  user: User,
): Promise<GuestState & { summary: SyncSummary }> {
  const [entriesResult, positionsResult, highlightsResult] = await Promise.all([
    supabase
      .from("user_saved_entries")
      .select("entry_slug,title,source_url,saved_at")
      .eq("user_id", user.id)
      .overrideTypes<RemoteSavedEntry[], { merge: false }>(),
    supabase
      .from("user_reading_positions")
      .select("entry_slug,source_url,scroll_y,scroll_ratio,updated_at")
      .eq("user_id", user.id)
      .overrideTypes<RemoteReadingPosition[], { merge: false }>(),
    supabase
      .from("user_highlights")
      .select(
        "id,local_id,entry_slug,source_url,quote,note,color,text_position,occurrence_index,prefix,suffix,created_at,updated_at",
      )
      .eq("user_id", user.id)
      .overrideTypes<RemoteHighlight[], { merge: false }>(),
  ]);

  throwIfError(entriesResult.error);
  throwIfError(positionsResult.error);
  throwIfError(highlightsResult.error);

  const nextState = await updateGuestState((latestState) => {
    mergeRemoteSavedEntries(latestState, entriesResult.data ?? []);
    mergeRemoteReadingPositions(latestState, positionsResult.data ?? []);
    mergeRemoteHighlights(latestState, highlightsResult.data ?? []);

    return latestState;
  });

  return {
    ...nextState,
    summary: {
      savedEntries: 0,
      readingPositions: 0,
      highlights: 0,
      deletedHighlights: 0,
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
  const pulled = await pullSupabaseStateIntoGuestState(supabase, user);

  return {
    ...pushed,
    pulledEntries: pulled.summary.pulledEntries,
    pulledReadingPositions: pulled.summary.pulledReadingPositions,
    pulledHighlights: pulled.summary.pulledHighlights,
  };
}
