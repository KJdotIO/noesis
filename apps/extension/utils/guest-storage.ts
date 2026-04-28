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
  createdAt: string;
  updatedAt: string;
};

export type GuestState = {
  version: 1;
  savedEntries: Record<string, GuestSavedEntry>;
  readingPositions: Record<string, GuestReadingPosition>;
  highlights: Record<string, GuestHighlight[]>;
};

const guestStateKey = "noesis:guest-state";

const emptyGuestState = (): GuestState => ({
  version: 1,
  savedEntries: {},
  readingPositions: {},
  highlights: {},
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
  };
}

export async function writeGuestState(state: GuestState): Promise<void> {
  await browser.storage.local.set({ [guestStateKey]: state });
}

export async function saveGuestEntry(entry: SepEntryContext): Promise<void> {
  const state = await readGuestState();

  state.savedEntries[entry.slug] = {
    ...entry,
    savedAt: new Date().toISOString(),
  };

  await writeGuestState(state);
}

export async function saveGuestReadingPosition(
  position: GuestReadingPosition,
): Promise<void> {
  const state = await readGuestState();
  state.readingPositions[position.slug] = position;
  await writeGuestState(state);
}
