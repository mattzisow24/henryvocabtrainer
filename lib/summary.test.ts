import { describe, expect, it } from "vitest";
import { formatSummary, parseSummary } from "./summary";

describe("session summaries", () => {
  it("stores a headline and only the fields that have something in them", () => {
    const text = formatSummary({ headline: " Solid session:  11 of 14 known. ", went_well: "roots", needs_work: "", next_focus: "contrast look-alikes" });
    expect(text).toBe("Solid session: 11 of 14 known.\nWent well: roots\nNext: contrast look-alikes");
    expect(parseSummary(text)).toEqual({
      headline: "Solid session: 11 of 14 known.",
      rows: [
        { label: "Went well", value: "roots" },
        { label: "Next", value: "contrast look-alikes" },
      ],
      more: "",
    });
  });

  it("shows an old paragraph summary as its first sentence, with the rest held back", () => {
    const old = "Covered 14 words and did well. He mixed up insolent and indolent. Focus on look-alikes next.";
    expect(parseSummary(old)).toEqual({
      headline: "Covered 14 words and did well.",
      rows: [],
      more: "He mixed up insolent and indolent. Focus on look-alikes next.",
    });
    expect(parseSummary("One sentence only.")).toEqual({ headline: "One sentence only.", rows: [], more: "" });
  });
});
