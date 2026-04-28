import type { GuestSavedEntry } from "./guest-storage";

export type SaveEntryMessage = {
  type: "noesis:save-entry";
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

export type NoesisMessage = SaveEntryMessage;
