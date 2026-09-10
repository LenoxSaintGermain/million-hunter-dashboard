import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import type { Connection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import { buildReleasePlan, reconcileReleaseStep } from "../../scripts/aperture-release-plan.mjs";
import { inspectMigrationStep } from "../../scripts/aperture-release-schema-state.mjs";
import { executeReleasePlan, REVIEWED_PLAN_SHA256 } from "../../scripts/aperture-release-executor.mjs";
import {
  INTEGRATION_DATABASE,
  INTEGRATION_USER,
  requireIsolatedIntegrationDatabase,
} from "../../scripts/isolated-integration-identity.mjs";

// Deliberately fail during collection, before importing a driver or opening a
// socket. No dotenv, application DB pool, router, provider, browser fixture,
// database provisioning, schema push, or fallback connection belongs here.
requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);

// Main: stage this file (the harness copies tracked files only), then add
// "server/aperture/objectiveMigration.integration.test.ts", to the integration
// include list and unit exclude list. Main alone runs the approved harness.
// This is existing-schema SQL coverage, not service/concurrency/release proof.
const SOURCES = {
  runway: ["0055_aperture_decision_runway_authority.sql", "b383a982c91baea69c5bce4190f1f05eb3e3d707eeb5c7b4daeca50232fd2e34"],
  options: ["0059_aperture_defined_risk_options.sql", "f2e1822114cb7405037ef4ab6060a720846ff73bf76449b1464f7c164612108c"],
  underwriting: ["0061_aperture_play_underwriting.sql", "aaedf5d92610fa2daedd0d71bd97643e1c0989e76eba69d4b9ad22d8ca5e5979"],
  ledger: ["0065_aperture_capital_ledger.sql", "d6566591dde81ca68665622f9aebc3ddec92ce1088cf0b41279ed70b01f4b03e"],
  objective: ["0066_aperture_objective_mission.sql", "001102be1a7dcdcaa6a6c36fb4f4c8f98904f0df3e792b7de10491e7b4df1cca"],
  discovery: ["0067_aperture_strategy_discovery.sql", "9e2472d3e3cb7e232f2fe7efba3d66b440cf5073f6440f528879a9e1b806c075"],
  selection: ["0068_aperture_discovery_selection.sql", "51b5fbb93e555469b187731e7fe67fdf298e381128cd471368cab141736f4e75"],
  executions: ["0069_aperture_execution_evidence.sql", "b6f8d5a68c05c8f67573edc56557788e4e5576064f4c721afba04ecb489db274"],
} as const;
const TABLES = {
  runs: "aperture_decision_runs",
  revisions: "aperture_decision_revisions",
  events: "aperture_capital_events",
  claims: "aperture_capital_claims",
  discoveries: "aperture_strategy_discoveries",
  selections: "aperture_discovery_selections",
  executions: "aperture_execution_evidence",
} as const;
type Table = keyof typeof TABLES;
type Ddl = { sql: string; operation: "CREATE" | "ALTER"; table: string };
const NOW = Date.UTC(2026, 8, 9, 19);
const OWNER = 1701;
const OTHER_OWNER = 1702;
const REQUEST = "11111111-1111-4111-8111-111111111111";

function statements(source: keyof typeof SOURCES): Ddl[] {
  const [file, hash] = SOURCES[source];
  const bytes = readFileSync(new URL(`../../drizzle/${file}`, import.meta.url));
  // Fail closed if reviewed migration bytes change; do not silently execute new
  // targets, a backfill, or destructive SQL. Hashes identify reviewed migration bytes.
  expect(createHash("sha256").update(bytes).digest("hex"), file).toBe(hash);
  return bytes.toString("utf8").split("--> statement-breakpoint")
    // These hash-pinned migrations contain line comments, including semicolons.
    // Remove only those comments before splitting executable statements.
    .flatMap(chunk => chunk.replace(/--[^\r\n]*/g, "").split(/(?<=;)/))
    .filter(sql => sql.trim())
    .map(sql => {
      // Columns, defaults and index names remain the actual migration SQL.
      const head = sql.trim();
      const match = /^(CREATE|ALTER) TABLE (?:IF NOT EXISTS )?`?([a-z_]+)`?\s/.exec(head);
      if (!match) throw new Error(`Unreviewed statement shape in ${file}`);
      return { sql, operation: match[1] as Ddl["operation"], table: match[2] };
    });
}

function renameTables(sql: string, names: ReadonlyMap<string, string>): string {
  // Token-level, exact identifiers only. Never replace substrings in indexes,
  // comments or string literals. This is not a general-purpose SQL parser.
  return sql.replace(/--[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:''|\\[\s\S]|[^'\\])*'|`[^`]*`|\b[A-Za-z_][A-Za-z0-9_]*\b/g, token => {
    const quoted = token.startsWith("`");
    const identifier = quoted ? token.slice(1, -1) : token;
    const replacement = names.get(identifier);
    return replacement ? (quoted ? `\`${replacement}\`` : replacement) : token;
  });
}

describe("0065–0069 existing receipt migration — owned disposable shadow tables", () => {
  it("retains legacy receipts and enforces objective and ledger identities using actual migration SQL", async () => {
    const target = requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
    const suffix = randomUUID().replaceAll("-", "");
    const shadow = Object.fromEntries(Object.keys(TABLES).map(key => [key, `objmig_${suffix}_${key}`])) as Record<Table, string>;
    const names = new Map(Object.entries(TABLES).map(([key, name]) => [name, shadow[key as Table]]));
    const reverse = new Map([...names].map(([original, renamed]) => [renamed, original]));
    const allowed = new Set(Object.values(shadow));
    const owned: string[] = [];
    const quote = (name: string) => {
      if (!allowed.has(name) || !/^objmig_[a-f0-9]{32}_(runs|revisions|events|claims|discoveries|selections|executions)$/.test(name)) {
        throw new Error("Refusing SQL outside this test's exact shadow tables");
      }
      return `\`${name}\``;
    };

    // Only the two receipt tables, with exact historical columns/constraints.
    // Unrelated 0055/0059/0061 DDL is never executed. Ledger tables did not exist
    // pre-0065. No current schema import can mask an ALTER compatibility defect.
    const receiptTables = new Set<string>([TABLES.runs, TABLES.revisions]);
    const base = statements("runway").filter(s => receiptTables.has(s.table));
    const options = statements("options").filter(s => s.table === TABLES.revisions);
    const underwriting = statements("underwriting").filter(s => s.table === TABLES.revisions);
    const ledger = statements("ledger");
    const objective = statements("objective");
    const discovery = statements("discovery");
    const selection = statements("selection");
    const executions = statements("executions");
    const shape = (ddl: Ddl[]) => ddl.map(({ operation, table }) => [operation, table]);
    expect(shape(base)).toEqual([["CREATE", TABLES.runs], ["CREATE", TABLES.revisions]]);
    expect(shape(options)).toEqual([["ALTER", TABLES.revisions]]);
    expect(shape(underwriting)).toEqual([["ALTER", TABLES.revisions]]);
    expect(shape(ledger)).toEqual([["CREATE", TABLES.events], ["CREATE", TABLES.claims]]);
    expect(shape(objective)).toEqual([["ALTER", TABLES.runs], ["ALTER", TABLES.runs], ["ALTER", TABLES.revisions]]);
    expect(shape(discovery)).toEqual([["CREATE", TABLES.discoveries]]);
    expect(shape(selection)).toEqual([["ALTER", TABLES.runs], ["CREATE", TABLES.selections]]);
    expect(shape(executions)).toEqual([["CREATE", TABLES.executions]]);

    const network = vi.fn(() => { throw new Error("Provider/broker calls forbidden in migration test"); });
    vi.stubGlobal("fetch", network);
    vi.spyOn(http, "request").mockImplementation(network);
    vi.spyOn(http, "get").mockImplementation(network);
    vi.spyOn(https, "request").mockImplementation(network);
    vi.spyOn(https, "get").mockImplementation(network);
    let db: Connection | undefined;
    try {
      const mysql = await import("mysql2/promise");
      db = await mysql.createConnection(target.toString());
      const connection = db;
      const rows = async (sql: string, values: unknown[] = []) => (await connection.query<RowDataPacket[]>(sql, values))[0];
      const releasePlan = buildReleasePlan((file: string) => readFileSync(new URL(`../../drizzle/${file}`, import.meta.url)));
      const schemaState = async () => {
        const map = (data: RowDataPacket[]) => data.filter(r => reverse.has(r.TABLE_NAME)).map(r => ({ ...r, TABLE_NAME: reverse.get(r.TABLE_NAME) }));
        return {
          tables: map(await rows("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()")).map(r => r.TABLE_NAME),
          columns: map(await rows("SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()")),
          statistics: map(await rows("SELECT TABLE_NAME,INDEX_NAME,COLUMN_NAME,SEQ_IN_INDEX,NON_UNIQUE,SUB_PART FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()")),
          checks: map(await rows("SELECT tc.TABLE_NAME,cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc ON tc.CONSTRAINT_SCHEMA=cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME=cc.CONSTRAINT_NAME WHERE tc.TABLE_SCHEMA=DATABASE() AND tc.CONSTRAINT_TYPE='CHECK'")),
        };
      };
      const identity = async () => {
        requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
        const [actual] = await rows("SELECT DATABASE() AS db, SUBSTRING_INDEX(CURRENT_USER(), '@', 1) AS user");
        expect(actual).toMatchObject({ db: INTEGRATION_DATABASE, user: INTEGRATION_USER });
      };
      await identity();
      const existingShadows = () => rows(
        `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${Object.values(shadow).map(() => '?').join(',')})`,
        Object.values(shadow),
      );
      // Never pre-drop/reuse a table, even in the approved database.
      expect(await existingShadows()).toEqual([]);

      const inspectedSteps = new Set<string>();
      const apply = async (ddl: Ddl[]) => {
        for (const statement of ddl) {
          const renamed = names.get(statement.table);
          if (!renamed) throw new Error("Migration target is outside owned shadow tables");
          quote(renamed);
          if (statement.operation === "ALTER" && !owned.includes(renamed)) throw new Error("Cannot alter an unowned table");
          const sql = renameTables(statement.sql, names);
          const normalize = (sql: string) => sql.trim().replace(/;$/, '').replace(/\s+/g, ' ');
          const releaseStep = releasePlan.steps.find((s: {sql: string}) => normalize(s.sql) === normalize(statement.sql));
          if (releaseStep) expect(inspectMigrationStep(releaseStep, await schemaState()).state, releaseStep.id).toBe('before');
          expect(sql).not.toBe(statement.sql);
          expect(renameTables(sql, reverse)).toBe(statement.sql);
          const [result] = await connection.query<ResultSetHeader>(sql);
          // Historical CREATE IF NOT EXISTS must not adopt a colliding table.
          // A different CREATE warning still leaves an owned table to clean up.
          if (statement.operation === "CREATE") {
            const warnings = result.warningStatus ? await rows("SHOW WARNINGS") : [];
            if (!warnings.some(warning => Number(warning.Code) === 1050)) owned.push(renamed);
            expect(warnings).toEqual([]);
          }
          expect(result.warningStatus).toBe(0);
          if (releaseStep) {
            const observed = inspectMigrationStep(releaseStep, await schemaState());
            expect(observed.state, `${releaseStep.id}: ${JSON.stringify(observed.issues)}`).toBe('after');
            inspectedSteps.add(releaseStep.id);
            expect(reconcileReleaseStep(releaseStep, { stepId: releaseStep.id, statementSha256: releaseStep.statementSha256, state: 'started' }, observed)).toBe('verify_and_record');
          }
        }
      };
      const insert = async (table: Table, values: Record<string, unknown>) => {
        const columns = Object.keys(values);
        if (columns.some(column => !/^[a-z_]+$/.test(column))) throw new Error("Invalid fixture column");
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO ${quote(shadow[table])} (${columns.map(column => `\`${column}\``).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
          Object.values(values),
        );
        return result.insertId;
      };
      const all = (table: Table) => rows(`SELECT * FROM ${quote(shadow[table])} ORDER BY id`);
      const columns = async (table: Table) => Object.fromEntries(
        (await rows(`SHOW FULL COLUMNS FROM ${quote(shadow[table])}`)).map(column => [column.Field, column]),
      );
      const indexes = async (table: Table) => {
        const result: Record<string, { unique: boolean; columns: string[] }> = {};
        for (const index of (await rows(`SHOW INDEX FROM ${quote(shadow[table])}`)).sort((a, b) => Number(a.Seq_in_index) - Number(b.Seq_in_index))) {
          (result[index.Key_name] ??= { unique: Number(index.Non_unique) === 0, columns: [] }).columns.push(index.Column_name);
        }
        return result;
      };
      const duplicate = async (operation: Promise<unknown>) => {
        await expect(operation).rejects.toMatchObject({ code: "ER_DUP_ENTRY", errno: 1062 });
      };

      // All DDL, fixture writes and assertions below are enclosed by exact-table
      // cleanup, including failed setup/migration/uniqueness assertions.
      try {
        await apply([...base, ...options, ...underwriting]);
        const oldColumns = await columns("runs");
        expect(oldColumns.context_kind).toBeUndefined();
        expect(oldColumns.client_request_id).toBeUndefined();
        expect(oldColumns.canonical_thesis_id.Null).toBe("NO");
        expect(oldColumns.capital_thesis_id.Null).toBe("NO");
        expect((await columns("revisions")).invalidation_rule.Null).toBe("NO");

        const head = { user_id: OWNER, canonical_thesis_id: 3701, capital_thesis_id: 4701,
          account_id: 2701, research_run_id: 7101, current_revision_id: 6102,
          lifecycle: "conditional", lock_version: 2, closed_at: null, created_at: NOW - 100, updated_at: NOW };
        await insert("runs", { ...head, id: 5101 });
        await insert("runs", { ...head, id: 5102, canonical_thesis_id: 3702, capital_thesis_id: 4702,
          account_id: 2702, research_run_id: 7102, current_revision_id: 6103, lifecycle: "closed", lock_version: 1, closed_at: NOW });
        const receipt = { decision_run_id: 5101, version: 1, previous_revision_id: null,
          mission_text: "Illustrative legacy thesis receipt; preserve whitespace.  \nNo live market claim.",
          mission_hash: "a".repeat(64), mission_source: "library", objective: "preserve_optionality",
          instrument_preference: "shares", include_held_research: true, deployable_capital_cents: 800_025,
          desired_ending_value_cents: 920_075, target_profit_cents: 120_050, target_period: "week",
          max_planned_loss_cents: 50_010, holding_period: "position", holding_periods: JSON.stringify(["swing", "position"]),
          invalidation_rule: "Illustrative invalidate-if rule.  \nRetain exact text.", operator_choice: "conditional",
          effective_branch: "conditional", selected_candidate_id: 8101, planned_risk_cents: 42_005,
          reason: "Illustrative human review only", blocker: "Unverified fixture catalyst", reopen_condition: "Review fixture evidence",
          review_at: NOW + 1000, named_gate_key: "fixture:legacy", named_gate_label: "Illustrative legacy gate",
          context_snapshot: JSON.stringify({ schemaVersion: 1, fixture: true, nested: { retained: [1, null, "legacy"] } }),
          gate_snapshot: JSON.stringify({ eligible: false, reasons: ["illustrative"] }), ranking_snapshot: JSON.stringify([]),
          created_by_user_id: OWNER, created_at: NOW - 100 };
        await insert("revisions", { ...receipt, id: 6101 });
        await insert("revisions", { ...receipt, id: 6102, version: 2, previous_revision_id: 6101,
          mission_hash: "b".repeat(64), mission_source: "edited", created_at: NOW });
        await insert("revisions", { ...receipt, id: 6103, decision_run_id: 5102, target_profit_cents: null,
          target_period: null, holding_periods: null, context_snapshot: null });
        const legacyHeads = await all("runs");
        const legacyReceipts = await all("revisions");
        const oldRunIndexes = await indexes("runs");
        const oldRevisionIndexes = await indexes("revisions");

        await apply(ledger);
        expect(await all("events")).toEqual([]); // No fabricated backfill.
        expect(await all("claims")).toEqual([]);
        expect(await all("runs")).toEqual(legacyHeads);
        expect(await all("revisions")).toEqual(legacyReceipts);
        await apply(objective);
        expect(await all("runs")).toEqual(legacyHeads.map(row => ({ ...row, context_kind: "thesis", client_request_id: null })));
        expect(await all("revisions")).toEqual(legacyReceipts);
        expect(await indexes("runs")).toEqual({ ...oldRunIndexes,
          aperture_decision_runs_owner_request_uq: { unique: true, columns: ["user_id", "client_request_id"] } });
        expect(await indexes("revisions")).toEqual(oldRevisionIndexes);
        const migratedColumns = await columns("runs");
        expect(migratedColumns.context_kind.Null).toBe("NO");
        expect(migratedColumns.context_kind.Type).toBe("enum('thesis','objective')");
        expect(String(migratedColumns.context_kind.Default).replace(/^'(.*)'$/, "$1")).toBe("thesis");
        expect(migratedColumns.client_request_id).toMatchObject({ Type: "varchar(36)", Null: "YES" });
        expect(migratedColumns.canonical_thesis_id.Null).toBe("YES");
        expect(migratedColumns.capital_thesis_id.Null).toBe("YES");
        expect((await columns("revisions")).invalidation_rule).toMatchObject({ Type: "text", Null: "YES" });

        // New thesis inserts still use the DB default, without passing either
        // new column. Multiple same-owner NULL requests must remain legal.
        const newThesis = { ...head, research_run_id: null, current_revision_id: null, lock_version: 0 };
        const thesisId = await insert("runs", newThesis);
        await insert("runs", newThesis);
        expect((await all("runs")).find(row => row.id === thesisId)).toMatchObject({
          context_kind: "thesis", client_request_id: null, canonical_thesis_id: 3701, capital_thesis_id: 4701,
        });
        const objectiveHead = { ...newThesis, canonical_thesis_id: null, capital_thesis_id: null,
          context_kind: "objective", client_request_id: REQUEST, lifecycle: "mission" };
        const objectiveId = await insert("runs", objectiveHead);
        const objectiveRevisionId = await insert("revisions", { ...receipt, decision_run_id: objectiveId,
          mission_text: "Illustrative capital question; no tactical thesis invented", invalidation_rule: null,
          context_snapshot: null, selected_candidate_id: null });
        expect((await all("runs")).find(row => row.id === objectiveId)).toMatchObject({
          context_kind: "objective", client_request_id: REQUEST, canonical_thesis_id: null, capital_thesis_id: null,
          research_run_id: null, current_revision_id: null,
        });
        expect((await all("revisions")).find(row => row.id === objectiveRevisionId)).toMatchObject({ invalidation_rule: null });
        await duplicate(insert("runs", objectiveHead));
        await duplicate(insert("runs", { ...objectiveHead, account_id: 2702 })); // Key is owner/request, not account/request.
        await duplicate(insert("runs", { ...newThesis, client_request_id: REQUEST })); // Not partitioned by context kind.
        await insert("runs", { ...objectiveHead, user_id: OTHER_OWNER });
        await insert("runs", { ...objectiveHead, client_request_id: "22222222-2222-4222-8222-222222222222" });
        await insert("runs", { ...objectiveHead, client_request_id: null });
        await insert("runs", { ...objectiveHead, client_request_id: null });
        await duplicate(insert("runs", { ...newThesis, user_id: OTHER_OWNER, research_run_id: 7101 }));
        await duplicate(insert("revisions", receipt)); // Existing run/version uniqueness survives.

        expect(await indexes("events")).toEqual({
          PRIMARY: { unique: true, columns: ["id"] },
          capital_event_owner_source_key_uq: { unique: true, columns: ["user_id", "source_key"] },
          capital_event_owner_source_uq: { unique: true, columns: ["user_id", "source_id"] },
          capital_event_owner_event_uq: { unique: true, columns: ["user_id", "capital_event_id"] },
          capital_event_owner_account_idx: { unique: false, columns: ["user_id", "account_id", "id"] },
        });
        expect(await indexes("claims")).toEqual({
          PRIMARY: { unique: true, columns: ["id"] },
          capital_claim_owner_allocation_uq: { unique: true, columns: ["user_id", "allocation_id"] },
          capital_claim_event_idx: { unique: false, columns: ["event_id", "id"] },
        });
        const event = { user_id: OWNER, account_id: 2701, account_label: "Illustrative shadow account", broker_id: "manual",
          source_id: "fixture:source", source_key: "fixture:key", capital_event_id: "fixture:event",
          source_kind: "operator_declared_excess", currency: "USD", amount_cents: 800_025,
          proof_basis: "operator_declared", created_at: NOW };
        const eventId = await insert("events", event);
        for (const uniqueColumn of ["source_id", "source_key", "capital_event_id"] as const) {
          await duplicate(insert("events", { ...event, account_id: 2702,
            source_id: `other:source:${uniqueColumn}`, source_key: `other:key:${uniqueColumn}`,
            capital_event_id: `other:event:${uniqueColumn}`, [uniqueColumn]: event[uniqueColumn] }));
        }
        const otherEventId = await insert("events", { ...event, user_id: OTHER_OWNER });
        const unknownEventId = await insert("events", { ...event, source_id: "unknown:source", source_key: "unknown:key",
          capital_event_id: "unknown:event", amount_cents: null, proof_basis: "unknown" });
        expect((await all("events")).find(row => row.id === unknownEventId)).toMatchObject({ amount_cents: null, proof_basis: "unknown" });
        const claim = { user_id: OWNER, account_id: 2701, event_id: eventId, allocation_id: "fixture:allocation",
          amount_cents: 50_010, state: "pending", previous_state: null, created_at: NOW, updated_at: NOW };
        await insert("claims", claim);
        await duplicate(insert("claims", { ...claim, account_id: 2702, event_id: unknownEventId }));
        await insert("claims", { ...claim, user_id: OTHER_OWNER, event_id: otherEventId });
        await insert("claims", { ...claim, allocation_id: "fixture:allocation-2" }); // Multiple allocations per event are legal.
        expect(await all("claims")).toHaveLength(3);
        expect(await all("events")).toHaveLength(3);

        const beforeDiscovery = { runs: await all("runs"), revisions: await all("revisions"), events: await all("events"), claims: await all("claims") };
        await apply(discovery);
        expect(await all("discoveries")).toEqual([]);
        expect(await indexes("discoveries")).toEqual({
          PRIMARY: { unique: true, columns: ["id"] },
          aperture_discovery_job_attempt_uq: { unique: true, columns: ["job_id", "attempt"] },
          aperture_discovery_owner_revision_idx: { unique: false, columns: ["user_id", "decision_revision_id", "id"] },
        });
        const discoveryColumns = await columns("discoveries");
        for (const column of ["request", "payload", "manifest", "result", "record_hash", "created_at"]) expect(discoveryColumns[column].Null).toBe("NO");
        const discoveryFixture = { user_id: OWNER, decision_run_id: objectiveId, decision_revision_id: objectiveRevisionId,
          job_id: 9001, attempt: 1, attempt_token: REQUEST, request: JSON.stringify({ fixture: true }),
          payload: JSON.stringify({ raw: "Illustrative raw bytes.  \nNot a market claim." }), manifest: JSON.stringify({ fixture: true }),
          result: JSON.stringify({ fixture: true }), record_hash: "d".repeat(64), created_at: NOW };
        await insert("discoveries", discoveryFixture);
        await duplicate(insert("discoveries", discoveryFixture));
        await duplicate(insert("discoveries", { ...discoveryFixture, user_id: OTHER_OWNER }));
        await insert("discoveries", { ...discoveryFixture, attempt: 2 });
        await insert("discoveries", { ...discoveryFixture, job_id: 9002 });
        expect(await all("discoveries")).toHaveLength(3);
        expect({ runs: await all("runs"), revisions: await all("revisions"), events: await all("events"), claims: await all("claims") }).toEqual(beforeDiscovery);

        const beforeSelection = { runs: await all("runs"), revisions: await all("revisions"), discoveries: await all("discoveries"), events: await all("events"), claims: await all("claims") };
        await apply(selection);
        expect({ runs: await all("runs"), revisions: await all("revisions"), discoveries: await all("discoveries"), events: await all("events"), claims: await all("claims") }).toEqual(beforeSelection);
        expect((await columns("runs")).context_kind.Type).toBe("enum('thesis','objective','discovery')");
        expect(await all("selections")).toEqual([]);
        const selectionFixture = { user_id: OWNER, source_decision_run_id: objectiveId, source_revision_id: objectiveRevisionId,
          discovery_receipt_id: 9101, hypothesis_id: "illustrative-lead", research_decision_run_id: 9201,
          research_revision_id: 9301, capital_thesis_id: 9401, source_record_hash: "d".repeat(64),
          context: JSON.stringify({ fixture: true }), record_hash: "e".repeat(64), created_at: NOW };
        await insert("selections", selectionFixture);
        await duplicate(insert("selections", selectionFixture));
        await duplicate(insert("selections", { ...selectionFixture, hypothesis_id: "other", capital_thesis_id: 9402 }));
        await duplicate(insert("selections", { ...selectionFixture, hypothesis_id: "other", research_decision_run_id: 9202 }));
        await insert("selections", { ...selectionFixture, user_id: OTHER_OWNER, research_decision_run_id: 9203, capital_thesis_id: 9403 });
        expect(await all("selections")).toHaveLength(2);
        const beforeExecutions = { runs: await all("runs"), revisions: await all("revisions"), selections: await all("selections") };
        // Real DDL succeeds but its caller loses the response. Resume must
        // inspect all nine postconditions and never issue this CREATE twice.
        const journal = new Map<string, any>();
        let executeCalls = 0;
        const releaseOptions = {
          plan: releasePlan, approvedPlanSha256: REVIEWED_PLAN_SHA256, expectedTarget: INTEGRATION_DATABASE,
          readTarget: async () => { await identity(); return INTEGRATION_DATABASE; },
          verifyLease: async () => true, // Exact private shadow names, owned by this test only.
          verifyRecovery: async () => true, // Disposable fixture; not production recovery evidence.
          readSchema: schemaState, readJournal: async (id: string) => journal.get(id),
          writeJournal: async (entry: any) => { journal.set(entry.stepId, entry); },
          execute: async (_sql: string, id: string) => {
            expect(id).toBe('0069_aperture_execution_evidence.sql:1');
            executeCalls++;
            await apply(executions);
            throw new Error('Illustrative lost DDL response');
          },
        };
        await expect(executeReleasePlan(releaseOptions)).rejects.toThrow('Illustrative lost DDL response');
        expect(journal.get('0069_aperture_execution_evidence.sql:1').state).toBe('started');
        const resumed = await executeReleasePlan(releaseOptions);
        expect(resumed).toMatchObject({ complete: true, applied: [] });
        expect(resumed.reconciled).toHaveLength(9);
        expect(executeCalls).toBe(1);
        expect(inspectedSteps.size).toBe(9);
        expect(await all("executions")).toEqual([]);
        const executionFixture = { user_id: OWNER, account_id: 81, run_id: 82, candidate_id: 83,
          order_id: 84, request_id: REQUEST, external_account_id: "illustrative-paper",
          broker_order_id: "illustrative-order", state: "pending", created_at: NOW };
        await insert("executions", executionFixture);
        await duplicate(insert("executions", { ...executionFixture, order_id: 85 }));
        await insert("executions", { ...executionFixture, user_id: OTHER_OWNER });
        expect(await all("executions")).toHaveLength(2);
        expect({ runs: await all("runs"), revisions: await all("revisions"), selections: await all("selections") }).toEqual(beforeExecutions);

        // Identity, history links, cents, timestamps, nullable values, exact text
        // and JSON survive both DDL and all rejected/successful new inserts.
        expect((await all("runs")).filter(row => row.id <= 5102)).toEqual(
          legacyHeads.map(row => ({ ...row, context_kind: "thesis", client_request_id: null })),
        );
        expect((await all("revisions")).filter(row => row.id <= 6103)).toEqual(legacyReceipts);
        expect(network).not.toHaveBeenCalled();
      } finally {
        await identity();
        const failures: unknown[] = [];
        // Explicit ownership list only; never DROP DATABASE, TRUNCATE, wildcard
        // discovery/deletion, shared fixture cleanup or foreign-key disabling.
        for (const table of [...owned].reverse()) {
          try { await connection.query(`DROP TABLE ${quote(table)}`); }
          catch (error) { failures.push(error); }
        }
        if (failures.length) throw new AggregateError(failures, "Owned shadow-table cleanup failed");
        expect(await existingShadows()).toEqual([]);
      }
    } finally {
      try { await db?.end(); }
      finally { vi.restoreAllMocks(); vi.unstubAllGlobals(); }
    }
  }, 30_000);
});
