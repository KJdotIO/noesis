const sepEntryPath = /^\/entries\/([^/]+)\/?$/;

export function deriveSepSlug(url: URL): string | null {
  if (url.hostname !== "plato.stanford.edu") {
    return null;
  }

  const match = sepEntryPath.exec(url.pathname);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export default defineContentScript({
  matches: ["https://plato.stanford.edu/entries/*"],
  main() {
    const slug = deriveSepSlug(new URL(window.location.href));
    if (!slug) {
      return;
    }

    document.documentElement.dataset.noesisSepSlug = slug;
  },
});
