import { describe, expect, it } from "vitest";
import { coachBrief, learnerLine, outlook, parentLine } from "./exam";

const DATE = "2026-12-05";

describe("the SAT date", () => {
  it("counts down to the test", () => {
    const o = outlook("2026-11-22", DATE);
    expect(o.daysAway).toBe(13);
    expect(learnerLine(o)).toBe("SAT in 13 days.");
    expect(parentLine(o)).toBe("SAT on Dec 5, in 13 days.");
    expect(coachBrief(o, "Henry")).toContain("in 13 days (Dec 5)");
  });

  it("tells the coach to stop teaching new words in the last days", () => {
    expect(coachBrief(outlook("2026-12-01", DATE), "Henry")).not.toContain("No new words");
    expect(coachBrief(outlook("2026-12-02", DATE), "Henry")).toContain("No new words");
    expect(learnerLine(outlook("2026-12-04", DATE))).toBe("SAT tomorrow.");
  });

  it("handles test day and afterwards", () => {
    expect(learnerLine(outlook(DATE, DATE))).toBe("SAT today.");
    expect(coachBrief(outlook(DATE, DATE), "Henry")).toContain("nothing new");
    const after = outlook("2026-12-08", DATE);
    expect(learnerLine(after)).toBe("The Dec 5 SAT is done.");
    expect(parentLine(after)).toBe("Took the SAT on Dec 5.");
  });
});
