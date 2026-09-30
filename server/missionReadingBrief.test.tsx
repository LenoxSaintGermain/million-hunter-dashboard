import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { MissionReadingBrief, missionReadingPassages } from "../client/src/components/aperture/MissionReadingBrief";
it("reflows explicit sections without changing wording, decimals, or timing", () => {
  const text = "Research only after 10:00 a.m. ET. Do not enter before 10:15. Evidence basis: Yield 4.19%. All eligibility gates are required: Volume 1.5 times normal. Use shares only, at most $5,000. Preserve cash if evidence is stale. Invalidate if the gate breaks. Close by 3:45 p.m. ET. Desired ending value $5,075 is an aspiration.";
  const passages = missionReadingPassages(text);
  expect(passages).toHaveLength(8);
  expect(passages.map(p => p.body).join(" ")).toBe(text);
  const html = renderToStaticMarkup(<MissionReadingBrief title="Payroll confirmation" text={text} horizon="Today / by close" edited={false}/>);
  expect(html).toContain("<h3>Payroll confirmation</h3>");
  expect(html).toContain("not refreshed automatically");
  expect(html).not.toContain("<h3>Research only");
});
it("keeps generic prose and empty instructions honest", () => {
  expect(missionReadingPassages("A belief without section cues.")[0].body).toBe("A belief without section cues.");
  expect(missionReadingPassages("   ")).toEqual([]);
});
