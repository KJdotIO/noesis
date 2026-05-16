import { describe, expect, test } from "bun:test";
import type { GuestState } from "./guest-storage";
import {
  mergeRemoteHighlights,
  mergeRemoteReadingPositions,
  mergeRemoteSavedEntries,
  type RemoteHighlight,
} from "./sync";

function guestState(): GuestState {
  return {
    version: 1,
    savedEntries: {},
    readingPositions: {},
    highlights: {},
    deletedHighlights: {},
    settings: {
      highlightsVisible: true,
      defaultHighlightColor: "yellow",
    },
  };
}

function remoteHighlight(overrides: Partial<RemoteHighlight>): RemoteHighlight {
  return {
    id: "remote-highlight",
    local_id: "local-highlight",
    entry_slug: "abduction",
    source_url: "https://plato.stanford.edu/entries/abduction/",
    quote: "U-diamondist",
    note: null,
    color: "yellow",
    text_position: 100,
    occurrence_index: 1,
    prefix: "before ",
    suffix: " after",
    created_at: "2026-05-16T10:00:00.000Z",
    updated_at: "2026-05-16T10:00:00.000Z",
    ...overrides,
  };
}

describe("sync merge helpers", () => {
  test("keeps a newer local reading position over an older remote row", () => {
    const state = guestState();
    state.readingPositions.abduction = {
      slug: "abduction",
      url: "https://plato.stanford.edu/entries/abduction/",
      scrollY: 900,
      scrollRatio: 0.9,
      updatedAt: "2026-05-16T12:00:00.000Z",
    };

    mergeRemoteReadingPositions(state, [
      {
        entry_slug: "abduction",
        source_url: "https://plato.stanford.edu/entries/abduction/",
        scroll_y: 100,
        scroll_ratio: 0.1,
        updated_at: "2026-05-16T11:00:00.000Z",
      },
    ]);

    expect(state.readingPositions.abduction.scrollY).toBe(900);
  });

  test("applies a newer remote saved entry", () => {
    const state = guestState();
    state.savedEntries.abduction = {
      slug: "abduction",
      title: "Old title",
      url: "https://plato.stanford.edu/entries/abduction/",
      savedAt: "2026-05-16T10:00:00.000Z",
    };

    mergeRemoteSavedEntries(state, [
      {
        entry_slug: "abduction",
        title: "Abduction",
        source_url: "https://plato.stanford.edu/entries/abduction/",
        saved_at: "2026-05-16T11:00:00.000Z",
      },
    ]);

    expect(state.savedEntries.abduction.title).toBe("Abduction");
  });

  test("does not resurrect a locally deleted remote highlight", () => {
    const state = guestState();
    state.deletedHighlights["local-highlight"] = {
      localId: "local-highlight",
      remoteId: "remote-highlight",
      slug: "abduction",
      deletedAt: "2026-05-16T12:00:00.000Z",
    };

    mergeRemoteHighlights(state, [remoteHighlight({})]);

    expect(state.highlights.abduction).toBeUndefined();
  });

  test("updates old local highlights with their remote id without overwriting newer edits", () => {
    const state = guestState();
    state.highlights.abduction = [
      {
        id: "local-highlight",
        slug: "abduction",
        quote: "U-diamondist",
        note: "local note",
        url: "https://plato.stanford.edu/entries/abduction/",
        color: "blue",
        createdAt: "2026-05-16T10:00:00.000Z",
        updatedAt: "2026-05-16T12:00:00.000Z",
      },
    ];

    mergeRemoteHighlights(state, [
      remoteHighlight({
        note: "remote note",
        color: "yellow",
        updated_at: "2026-05-16T11:00:00.000Z",
      }),
    ]);

    expect(state.highlights.abduction[0]?.note).toBe("local note");
    expect(state.highlights.abduction[0]?.color).toBe("blue");
    expect(state.highlights.abduction[0]?.remoteId).toBe("remote-highlight");
  });
});
