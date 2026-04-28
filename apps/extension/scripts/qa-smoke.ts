const sepUrl = "https://plato.stanford.edu/entries/abduction/";

async function main() {
  const response = await fetch(sepUrl);
  if (!response.ok) {
    throw new Error(`Could not fetch SEP smoke page: ${response.status}`);
  }

  const html = await response.text();
  const checks = [
    ["SEP entry page", /<body[^>]+class=["'][^"']*article[^"']*["']/],
    ["title metadata", /<meta[^>]+name=["']DC\.title["'][^>]+content=["']Abduction["']/],
    ["article content root", /id=["']article-content["']/],
    ["preamble text region", /id=["']preamble["']/],
    ["main text region", /id=["']main-text["']/],
  ] as const;

  const failures = checks
    .filter(([, pattern]) => !pattern.test(html))
    .map(([name]) => name);

  if (failures.length > 0) {
    throw new Error(`SEP smoke checks failed: ${failures.join(", ")}`);
  }

  console.log(`SEP smoke checks passed for ${sepUrl}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
