import * as cheerio from "cheerio";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

const testUrls: string[] = [
  "https://plato.stanford.edu/entries/abduction/",
  "https://plato.stanford.edu/entries/abelard/",
  "https://plato.stanford.edu/entries/abhidharma/",
  "https://plato.stanford.edu/entries/abilities/",
  "https://plato.stanford.edu/entries/abortion/",
  "https://plato.stanford.edu/entries/abrabanel/",
  "https://plato.stanford.edu/entries/abstract-objects/",
  "https://plato.stanford.edu/entries/essential-accidental/",
  "https://plato.stanford.edu/entries/action/",
  "https://plato.stanford.edu/entries/shared-agency/",
  "https://plato.stanford.edu/entries/logic-action/",
  "https://plato.stanford.edu/entries/practical-reason-action/",
  "https://plato.stanford.edu/entries/reasons-agent/",
  "https://plato.stanford.edu/entries/reasons-internal-external/",
  "https://plato.stanford.edu/entries/reasons-just-vs-expl/",
  "https://plato.stanford.edu/entries/action-perception/",
  "https://plato.stanford.edu/entries/qm-action-distance/",
  "https://plato.stanford.edu/entries/possibilism-actualism/",
  "https://plato.stanford.edu/entries/actualism-possibilism-ethics/",
  "https://plato.stanford.edu/entries/ethics-virtue/",
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchUrl = async (url: string): Promise<Result<string>> => {
  try {
    console.log(`Making a request to ${url} ...`);
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`Failed to fetch ${url}`);
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

    console.log(`Successfully grabbed HTML from ${url}.`);
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
  console.log(`Extracting fields from ${url} ...`);
  const fetched = await fetchUrl(url);
  if (!fetched.ok) {
    return fetched;
  }

  let parsed: ReturnType<typeof EntrySchema.safeParse>;

  try {
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

    parsed = EntrySchema.safeParse({
      slug,
      title,
      authors,
      issued,
      modified,
      fetched_at: new Date().toISOString(),
      source_url: url,
    });
  } catch (err) {
    return {
      ok: false,
      error: {
        url,
        stage: "extract",
        message: err instanceof Error ? err.message : "Unknown extract error",
        timestamp: new Date().toISOString(),
      },
    };
  }

  if (!parsed.success) {
    console.log(`Failed to validate schema from ${url}.`);
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

  console.log(`Schema validated from ${url}.`);
  return {
    ok: true,
    data: parsed.data,
  };
};

const finalJson: Entry[] = [];
const errArray: ErrorInfo[] = [];

for (const url of testUrls) {
  const result = await fetchEntry(url);

  if (!result.ok) {
    console.log(`Pushing ${url} to error array.`);
    errArray.push(result.error);
  } else {
    console.log(`Pushing ${url} to entries array.`);
    finalJson.push(result.data);
  }

  await sleep(500);
}

const entryJson = JSON.stringify(finalJson, null, 2);
const errorJson = JSON.stringify(errArray, null, 2);

fs.writeFileSync(path.join("../../data", "entries.json"), entryJson);
fs.writeFileSync(path.join("../../data", "errors.json"), errorJson);
