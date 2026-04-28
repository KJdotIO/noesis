import { getSepEntryContext } from "../utils/sep";

export default defineContentScript({
  matches: ["https://plato.stanford.edu/entries/*"],
  main() {
    const entry = getSepEntryContext(document);
    if (!entry) {
      return;
    }

    document.documentElement.dataset.noesisSepSlug = entry.slug;
  },
});
