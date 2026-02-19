import * as cheerio from "cheerio";
import { z } from "zod";

const testUrls: string[] = [
  "https://plato.stanford.edu/entries/ethics-virtue/",
  "https://plato.stanford.edu/entries/abduction/",
  "https://plato.stanford.edu/entries/abilities/",
];

const EntrySchema = z.object({
  title: z.string(),
  authors: z.array(z.string()).min(1),
  issued: z.string(),
  modified: z.string(),
  source_url: z.string(),
  slug: z.string(),
  fetched_at: z.iso.datetime(),
});

const ErrorSchema = z.object({
  url: z.string(),
  stage: z.enum(["fetch", "extract", "validation"]),
  message: z.string(),
  timestamp: z.iso.datetime(),
  status: z.number().optional(),
});

type Result<T> = { ok: true; data: T } | { ok: false; error: ErrorInfo };

type Entry = z.infer<typeof EntrySchema>;
type ErrorInfo = z.infer<typeof ErrorSchema>;

const errArray: ErrorInfo[] = [];

const fetchUrl = async (url: string): Promise<Result<string>> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        ok: false,
        error: {
          url,
          stage: "fetch",
          message: `HTTP ${response.status} ${response.statusText}`,
          status: response.status,
          timestamp: new Date().toISOString(),
        },
      };
    }
    const html = await response.text();
    return {
      ok: true,
      data: html,
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        url,
        stage: "fetch",
        message: err instanceof Error ? err.message : "Unknown fetch error",
        timestamp: new Date().toISOString(),
      },
    };
  }
};

const fetchEntry = async (url: string): Promise<Result<Entry>> => {
  const fetched = await fetchUrl(url);
  if (!fetched.ok) {
    return fetched;
  }

  const $ = cheerio.load(fetched.data);
  const title = $("head meta[name='DC.title']").attr("content");
  const authorNodes = $("head meta[name='DC.creator']");
  const issued = $("head meta[name='DCTERMS.issued']").attr("content");
  const modified = $("head meta[name='DCTERMS.modified']").attr("content");
  const authors: string[] = [];

  authorNodes.each((_, el) => {
    const value = $(el).attr("content")?.trim();
    if (value) {
      authors.push(value);
    }
  });

  const slug = url.split("entries/")[1]?.split("/")[0];

  const parsed = EntrySchema.safeParse({
    slug,
    title,
    authors,
    issued,
    modified,
    fetched_at: new Date().toISOString(),
    source_url: url,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        url,
        stage: "validation",
        message: parsed.error.message,
        timestamp: new Date().toISOString(),
      },
    };
  }

  return {
    ok: true,
    data: parsed.data,
  };
};

const finalJson: Entry[] = [];

for (const url of testUrls) {
  const result = await fetchEntry(url);

  if (!result.ok) {
    errArray.push(result.error);
    continue;
  }

  finalJson.push(result.data);
}

console.log(finalJson, errArray);
