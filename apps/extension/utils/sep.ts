export type SepEntryContext = {
  slug: string;
  title: string;
  url: string;
};

const sepEntryPath = /^\/entries\/([^/]+)\/?$/;

export function deriveSepSlug(url: URL): string | null {
  if (url.hostname !== "plato.stanford.edu") {
    return null;
  }

  const match = sepEntryPath.exec(url.pathname);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function getSepEntryContext(document: Document): SepEntryContext | null {
  const url = new URL(document.location.href);
  const slug = deriveSepSlug(url);

  if (!slug) {
    return null;
  }

  const canonicalUrl =
    document.querySelector<HTMLLinkElement>("link[rel='canonical']")?.href ??
    url.href;

  const title =
    document
      .querySelector<HTMLMetaElement>("meta[name='DC.title']")
      ?.content.trim() ||
    document.title.replace(" (Stanford Encyclopedia of Philosophy)", "").trim();

  return {
    slug,
    title,
    url: canonicalUrl,
  };
}
