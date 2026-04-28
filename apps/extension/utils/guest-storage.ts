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

export type GuestState = {
  version: 1;
  savedEntries: Record<string, GuestSavedEntry>;
  readingPositions: Record<string, GuestReadingPosition>;
  highlights: Record<string, GuestHighlight[]>;
  settings: GuestSettings;
};

const guestStateKey = "noesis:guest-state";

const emptyGuestState = (): GuestState => ({
  version: 1,
  savedEntries: {},
  readingPositions: {},
  highlights: {},
  settings: {
    highlightsVisible: true,
    defaultHighlightColor: "yellow",
  },
});

export async function readGuestState(): Promise<GuestState> {
  const stored = await browser.storage.local.get(guestStateKey);
  const state = stored[guestStateKey] as Partial<GuestState> | undefined;

  return {
    ...emptyGuestState(),
    ...state,
    savedEntries: state?.savedEntries ?? {},
    readingPositions: state?.readingPositions ?? {},
    highlights: state?.highlights ?? {},
    settings: {
      ...emptyGuestState().settings,
      ...state?.settings,
    },
  };
}

export async function writeGuestState(state: GuestState): Promise<void> {
  await browser.storage.local.set({ [guestStateKey]: state });
}

export async function getGuestSavedEntry(
  slug: string,
): Promise<GuestSavedEntry | null> {
  const state = await readGuestState();
  return state.savedEntries[slug] ?? null;
}

export async function saveGuestEntry(
  entry: SepEntryContext,
): Promise<GuestSavedEntry> {
  const state = await readGuestState();
  const savedEntry = {
    ...entry,
    savedAt: new Date().toISOString(),
  };

  state.savedEntries[entry.slug] = savedEntry;

  await writeGuestState(state);
  return savedEntry;
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
  const state = await readGuestState();
  state.readingPositions[position.slug] = position;
  await writeGuestState(state);
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
  const state = await readGuestState();
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

  await writeGuestState(state);
  return savedHighlight;
}

export async function deleteGuestHighlight(
  slug: string,
  highlightId: string,
): Promise<void> {
  const state = await readGuestState();
  state.highlights[slug] = (state.highlights[slug] ?? []).filter(
    (highlight) => highlight.id !== highlightId,
  );
  await writeGuestState(state);
}

export async function updateGuestHighlight(
  slug: string,
  highlightId: string,
  updates: Pick<Partial<GuestHighlight>, "note" | "color">,
): Promise<GuestHighlight | null> {
  const state = await readGuestState();
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
  await writeGuestState(state);
  return updatedHighlight;
}

export async function updateGuestSettings(
  settings: Partial<GuestSettings>,
): Promise<GuestSettings> {
  const state = await readGuestState();
  state.settings = {
    ...state.settings,
    ...settings,
  };
  await writeGuestState(state);
  return state.settings;
}
