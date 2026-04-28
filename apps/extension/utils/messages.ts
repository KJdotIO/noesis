import type { GuestSavedEntry } from "./guest-storage";

export type SaveEntryMessage = {
  type: "noesis:save-entry";
};

export type SetHighlightsVisibleMessage = {
  type: "noesis:set-highlights-visible";
  visible: boolean;
};

export type SaveEntryResponse =
  | {
      ok: true;
      entry: GuestSavedEntry;
    }
  | {
      ok: false;
      error: string;
    };

export type NoesisMessage = SaveEntryMessage | SetHighlightsVisibleMessage;
