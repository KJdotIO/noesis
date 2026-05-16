import type { SepEntryContext } from "./sep";

export type GuestSavedEntry = SepEntryContext & {
  savedAt: string;
};

export type GuestReadingPosition = {
  slug: string;
  url: string;
  scrollY: number;
  scrollRatio: number;
  updatedAt: string;
};

export type GuestHighlight = {
  id: string;
  remoteId?: string;
  slug: string;
  quote: string;
  note?: string;
  url: string;
  color?: HighlightColor;
  textPosition?: number;
  occurrenceIndex?: number;
  prefix?: string;
  suffix?: string;
  createdAt: string;
  updatedAt: string;
};

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple";

export type GuestSettings = {
  highlightsVisible: boolean;
  defaultHighlightColor: HighlightColor;
};

export type DeletedGuestHighlight = {
  localId: string;
  remoteId?: string;
  slug: string;
  deletedAt: string;
};

export type GuestState = {
  version: 1;
  savedEntries: Record<string, GuestSavedEntry>;
  readingPositions: Record<string, GuestReadingPosition>;
  highlights: Record<string, GuestHighlight[]>;
  deletedHighlights: Record<string, DeletedGuestHighlight>;
  settings: GuestSettings;
};

const guestStateKey = "noesis:guest-state";
let guestStateWriteQueue = Promise.resolve();

const emptyGuestState = (): GuestState => ({
  version: 1,
  savedEntries: {},
  readingPositions: {},
  highlights: {},
  deletedHighlights: {},
  settings: {
    highlightsVisible: true,
    defaultHighlightColor: "yellow",
  },
});

export async function readGuestState(): Promise<GuestState> {
  const stored = await browser.storage.local.get(guestStateKey);
  const state = stored[guestStateKey] as Partial<GuestState> | undefined;
  const baseState = emptyGuestState();

  return {
    ...baseState,
    ...state,
    savedEntries: state?.savedEntries ?? {},
    readingPositions: state?.readingPositions ?? {},
    highlights: state?.highlights ?? {},
    deletedHighlights: state?.deletedHighlights ?? {},
    settings: {
      ...baseState.settings,
      ...state?.settings,
    },
  };
}

async function writeGuestState(state: GuestState): Promise<void> {
  await browser.storage.local.set({ [guestStateKey]: state });
}

async function withGuestStateLock<T>(operation: () => Promise<T>): Promise<T> {
  const locks = navigator.locks;
  if (locks) {
    return locks.request("noesis:guest-state", operation);
  }

  const nextWrite = guestStateWriteQueue.then(operation, operation);
  guestStateWriteQueue = nextWrite.then(
    () => undefined,
    () => undefined,
  );
  return nextWrite;
}

export async function updateGuestState<T>(
  mutator: (state: GuestState) => T | Promise<T>,
): Promise<T> {
  return withGuestStateLock(async () => {
    const state = await readGuestState();
    const result = await mutator(state);
    await writeGuestState(state);
    return result;
  });
}

export async function saveGuestEntry(
  entry: SepEntryContext,
): Promise<GuestSavedEntry> {
  return updateGuestState((state) => {
    const savedEntry = {
      ...entry,
      savedAt: new Date().toISOString(),
    };

    state.savedEntries[entry.slug] = savedEntry;

    return savedEntry;
  });
}

export async function getGuestReadingPosition(
  slug: string,
): Promise<GuestReadingPosition | null> {
  const state = await readGuestState();
  return state.readingPositions[slug] ?? null;
}

export async function saveGuestReadingPosition(
  position: GuestReadingPosition,
): Promise<void> {
  await updateGuestState((state) => {
    state.readingPositions[position.slug] = position;
  });
}

export async function getGuestHighlights(
  slug: string,
): Promise<GuestHighlight[]> {
  const state = await readGuestState();
  return state.highlights[slug] ?? [];
}

export async function saveGuestHighlight(
  highlight: Omit<GuestHighlight, "id" | "createdAt" | "updatedAt">,
): Promise<GuestHighlight> {
  return updateGuestState((state) => {
    const now = new Date().toISOString();
    const savedHighlight = {
      ...highlight,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    state.highlights[highlight.slug] = [
      ...(state.highlights[highlight.slug] ?? []),
      savedHighlight,
    ];

    return savedHighlight;
  });
}

export async function deleteGuestHighlight(
  slug: string,
  highlightId: string,
): Promise<void> {
  await updateGuestState((state) => {
    const highlight = (state.highlights[slug] ?? []).find(
      (item) => item.id === highlightId,
    );

    if (highlight) {
      state.deletedHighlights[highlight.id] = {
        localId: highlight.id,
        remoteId: highlight.remoteId,
        slug,
        deletedAt: new Date().toISOString(),
      };
    }

    state.highlights[slug] = (state.highlights[slug] ?? []).filter(
      (highlight) => highlight.id !== highlightId,
    );
  });
}

export async function updateGuestHighlight(
  slug: string,
  highlightId: string,
  updates: Pick<Partial<GuestHighlight>, "note" | "color">,
): Promise<GuestHighlight | null> {
  return updateGuestState((state) => {
    const highlights = state.highlights[slug] ?? [];
    const highlightIndex = highlights.findIndex(
      (highlight) => highlight.id === highlightId,
    );

    if (highlightIndex < 0) {
      return null;
    }

    const updatedHighlight = {
      ...highlights[highlightIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    highlights[highlightIndex] = updatedHighlight;
    state.highlights[slug] = highlights;
    return updatedHighlight;
  });
}

export async function updateGuestSettings(
  settings: Partial<GuestSettings>,
): Promise<GuestSettings> {
  return updateGuestState((state) => {
    state.settings = {
      ...state.settings,
      ...settings,
    };
    return state.settings;
  });
}
