import { describe, expect, test } from "bun:test";
import {
  countNormalizedOccurrences,
  findNormalizedQuotePosition,
  getNormalizedQuote,
  normalizeSearchText,
} from "./highlight-anchors";

describe("highlight anchoring", () => {
  test("matches SEP display blocks across rendered line breaks", () => {
    const articleText =
      "example is inferences instantiating the schema All As are Bs. a is an A. Hence, a is a B. But not all";
    const quote = "All As are Bs.\na is an A.\nHence, a is a B.";

    expect(getNormalizedQuote(quote)).toBe(
      "All As are Bs. a is an A. Hence, a is a B.",
    );
    expect(
      findNormalizedQuotePosition(articleText, {
        quote,
      }),
    ).toBe(articleText.indexOf("All As"));
  });

  test("keeps repeated text anchored to the selected occurrence", () => {
    const articleText = normalizeSearchText(
      "Eudaemonist views differ. Later, eudaemonist views return.",
    );
    const quote = "eudaemonist";

    expect(countNormalizedOccurrences("Eudaemonist views differ. Later, ", quote))
      .toBe(0);
    expect(
      findNormalizedQuotePosition(articleText, {
        quote,
        occurrenceIndex: 1,
      }),
    ).toBe(articleText.lastIndexOf(quote));
  });

  test("uses surrounding context before falling back to the first match", () => {
    const articleText = normalizeSearchText(
      "truth appears early. Later the truth appears with context.",
    );

    expect(
      findNormalizedQuotePosition(articleText, {
        quote: "truth",
        prefix: "Later the ",
        suffix: " appears",
      }),
    ).toBe(articleText.lastIndexOf("truth"));
  });
});
