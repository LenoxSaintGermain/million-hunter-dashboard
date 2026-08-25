import crypto from "node:crypto";
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const APPLY = process.argv.includes("--apply");

const JIM_SOURCE_PATH = "scripts/run-jim-catalyst-reference-trial.mjs";
const JIM_SOURCE_SHA256 = "e022f209e96c992c937c556f873f0e343b645d4924bb0484265d4f92f3a731ee";

const JIM_RAW_TEXT = `I only want to research and paper-trade confirmed intraday reactions to dated macroeconomic or company catalysts. I do not anticipate reactions overnight and I do not hold leveraged ETFs overnight. My priority is a housing-data reaction through XHB, a post-earnings opening-range reaction in HD, and one conditional Nasdaq relative-strength branch through either TQQQ or SQQQ. I choose only one housing expression at a time: never both XHB and HD. I choose only one Nasdaq branch: never both TQQQ and SQQQ.

I act only after the stated release or earnings event and only if price confirmation, sustained volume, and VWAP alignment agree. For housing, the catalyst is new residential construction at 8:30 a.m. ET and industrial production at 9:15 a.m. ET. For HD, I wait through the first 30 minutes after the earnings release/call and require an orderly pullback plus an opening-range break aligned with VWAP. For the Nasdaq branch, I require QQQ relative-strength confirmation and a single directional leveraged-ETF branch aligned with VWAP. I skip gapped or disordered opens, repeated VWAP crossings, no sustained volume, and any setup that requires a stop wider than the stated loss budget.

I use only a $2,000–$10,000 short-term research bucket. Planned loss per setup is 0.50%–0.75% of the active bucket. Absolute loss must never exceed 2% of the active bucket. The combined planned loss for one housing play and the Nasdaq play must not exceed 1.25% of the active bucket. Position quantity must be calculated from risk dollars divided by entry-to-stop distance plus a stated slippage allowance; notional cannot substitute for this risk calculation. I close XHB by 3:30 p.m., HD by the close and earlier if the response never develops, and any TQQQ or SQQQ position by 3:45 p.m. ET. A reclaim of the invalidation level cancels the setup or exits the paper position.

I seek liquid U.S. housing, home-improvement, technology, semiconductor, and index ETF expressions of those catalysts. I exclude overnight positions, simultaneous correlated housing exposure, simultaneous leveraged long and short Nasdaq exposure, and any position that lacks a dated catalyst, confirmed price/VWAP/volume evidence, an explicit stop, a time stop, and a current risk calculation. I research no more than three candidate expressions in one catalyst window and prepare at most one paper proposal per active branch.`;

const GLP1_RAW_TEXT = `I am testing a paper-only, event-driven trading thesis on how GLP-1 adoption may create short-term price dislocations across food, beverage, healthcare, obesity-treatment, nutrition, medical-device, and consumer-staples companies.

The primary focus is day trades and short-term swing trades, with a secondary horizon of several weeks to a few months. Do not assume that GLP-1 adoption benefits or harms any company. Identify the specific catalyst, expected transmission mechanism, affected securities, liquidity, and timing.

Prioritize liquid stocks and ETFs with reliable pricing, tight spreads, meaningful volume, and clearly observable catalysts such as earnings, guidance changes, clinical or regulatory news, prescription or adoption data, analyst revisions, pricing changes, product launches, or material company disclosures.

For every candidate, provide:
1. The catalyst and date.
2. The expected GLP-1 exposure pathway.
3. The evidence supporting the trade direction.
4. The technical or market confirmation required before entry.
5. A potential entry zone, invalidation level, profit-taking framework, and maximum paper position size.
6. Key risks, including crowded positioning, broad-market movement, false correlation, earnings surprises, regulatory changes, and limited liquidity.
7. Whether the setup is suitable for an intraday trade, short-term swing, or medium-term watchlist.

Use a defined holding-period framework:
- Day trade: same-session thesis with no overnight assumption.
- Short-term swing: approximately 2–20 trading days.
- Medium-term: approximately 1–3 months.

Do not create or submit orders. Do not infer missing facts. Clearly label confirmed evidence, assumptions, unknowns, and signals that would invalidate the thesis. The final output should be a paper-trading decision memo and research ledger, not a recommendation to invest real money.

This wording should test whether your app can distinguish catalysts, evidence, time horizons, risk controls, and paper-only execution.`;

const RECOVERIES = [
  {
    key: "jim_catalyst",
    ownerId: 1,
    ownerEmail: "treble.design@gmail.com",
    name: "Jim Reference — Catalyst Reaction (Paper Trial)",
    rawText: JIM_RAW_TEXT,
    source: `${JIM_SOURCE_PATH} sha256:${JIM_SOURCE_SHA256}; source script explicitly binds USER.id=1`,
  },
  {
    key: "jim_glp1",
    ownerId: 7470015,
    ownerEmail: "gws@conciergecareerservices.com",
    name: "GLP-1 Demand Shock: Food & Health Day-Trading Opportunities",
    rawText: GLP1_RAW_TEXT,
    source: "Verbatim source text and owner mapping supplied by Lenox Saint Germain on 2026-08-25; immutable walkthrough capture v3 corroborates title/run context only",
  },
];

const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");

async function assertJimSourceIntegrity() {
  const contents = await fs.readFile(new URL(`../${JIM_SOURCE_PATH}`, import.meta.url));
  const actual = crypto.createHash("sha256").update(contents).digest("hex");
  if (actual !== JIM_SOURCE_SHA256) {
    throw new Error(`Jim source hash mismatch: expected ${JIM_SOURCE_SHA256}, received ${actual}. Refusing recovery.`);
  }
  if (!contents.toString("utf8").includes(JIM_RAW_TEXT)) {
    throw new Error("Jim source no longer contains the exact recovered raw thesis. Refusing recovery.");
  }
}

async function loadExisting(db, target) {
  const [[owner]] = await db.execute(
    "SELECT id, email FROM users WHERE id = ? AND email = ? LIMIT 1",
    [target.ownerId, target.ownerEmail],
  );
  if (!owner) throw new Error(`Owner validation failed for ${target.key}; refusing recovery.`);

  const [compilations] = await db.execute(
    "SELECT id, thesis_text, status FROM thesis_compilations WHERE user_id = ? AND name = ? ORDER BY id ASC",
    [target.ownerId, target.name],
  );
  const [capital] = await db.execute(
    "SELECT id, source_compilation_id, raw_text, status, is_primary FROM capital_theses WHERE user_id = ? AND name = ? ORDER BY id ASC",
    [target.ownerId, target.name],
  );
  return { owner, compilations, capital };
}

function assertNoConflictingDuplicates(target, existing) {
  const expectedHash = digest(target.rawText);
  const duplicateHashes = [
    ...existing.compilations.map((row) => digest(row.thesis_text)),
    ...existing.capital.map((row) => digest(row.raw_text)),
  ];
  if (duplicateHashes.some((hash) => hash !== expectedHash)) {
    throw new Error(`Existing same-name record differs from the source text for ${target.key}; refusing overwrite or duplicate creation.`);
  }
  if (existing.compilations.length > 1 || existing.capital.length > 1) {
    throw new Error(`Multiple same-name records already exist for ${target.key}; refusing ambiguous reconciliation.`);
  }
}

async function dryRun(db) {
  const plan = [];
  for (const target of RECOVERIES) {
    const existing = await loadExisting(db, target);
    assertNoConflictingDuplicates(target, existing);
    plan.push({
      key: target.key,
      owner: existing.owner,
      thesisTextSha256: digest(target.rawText),
      canonicalCompilation: existing.compilations.length ? "reuse_exact" : "create_review",
      capitalThesis: existing.capital.length ? "reuse_exact" : "create_review",
      activeThesisChange: "set_canonical_if_null_or_recovered_projection",
      shareChange: "none",
      runChange: "none",
      outcomeChange: "none",
      brokerOrderChange: "none",
      provenance: target.source,
    });
  }
  return plan;
}

async function apply(db) {
  const plan = await dryRun(db);
  await db.beginTransaction();
  try {
    const now = Date.now();
    for (const target of RECOVERIES) {
      const existing = await loadExisting(db, target);
      let compilationId = existing.compilations[0]?.id;
      if (!compilationId) {
        const [result] = await db.execute(
          `INSERT INTO thesis_compilations
            (user_id, thesis_text, template_used, compiled_filters, scoring_weights, evidence_requirements, auto_disqualifiers, confidence_notes, status, name, created_at, updated_at)
           VALUES (?, ?, 'stage1_recovery', JSON_OBJECT(), JSON_ARRAY(), JSON_ARRAY(), JSON_ARRAY(), JSON_ARRAY(?), 'review', ?, NOW(), NOW())`,
          [target.ownerId, target.rawText, `Recovered verbatim. ${target.source}. No historical compilation, run, outcome, or measurement was recreated.`, target.name],
        );
        compilationId = result.insertId;
      }

      const capitalExisting = existing.capital[0];
      let capitalThesisId = capitalExisting?.id;
      if (!capitalExisting) {
        const [result] = await db.execute(
          `INSERT INTO capital_theses
            (user_id, name, raw_text, source_compilation_id, graph, confidence_notes, status, is_primary, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, JSON_ARRAY(?), 'review', 0, ?, ?)`,
          [target.ownerId, target.name, target.rawText, compilationId, `Recovered verbatim from approved source. ${target.source}. Graph intentionally remains null pending explicit compilation; no history was backfilled.`, now, now],
        );
        capitalThesisId = result.insertId;
      } else if (capitalExisting.source_compilation_id == null) {
        await db.execute(
          "UPDATE capital_theses SET source_compilation_id = ?, updated_at = ? WHERE id = ?",
          [compilationId, now, capitalExisting.id],
        );
      }
      const [[ownerContext]] = await db.execute("SELECT active_capital_thesis_id FROM users WHERE id = ? LIMIT 1", [target.ownerId]);
      if ((ownerContext?.active_capital_thesis_id == null || ownerContext.active_capital_thesis_id === capitalThesisId) && compilationId) {
        await db.execute("UPDATE users SET active_capital_thesis_id = ?, updatedAt = NOW() WHERE id = ?", [compilationId, target.ownerId]);
      }
    }
    await db.commit();
    return plan;
  } catch (error) {
    await db.rollback();
    throw error;
  }
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
await assertJimSourceIntegrity();
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const plan = APPLY ? await apply(db) : await dryRun(db);
  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry_run", plan, brokerOrderIntent: "none" }, null, 2));
} finally {
  db.destroy();
}
