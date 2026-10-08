/**
 * Test-only in-memory stand-in for the Drizzle MySQL client. It renders each
 * condition with Drizzle's own MySQL dialect and evaluates the small SQL subset
 * the practice-book paths use (and/or/not, = <> > >= < <=, in, is [not] null).
 * Never imported by application code.
 */
import { getTableColumns, getTableName, type Table } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const dialect = new MySqlDialect();
type Row = Record<string, any>;
type Token = { t: "col"; table: string; col: string } | { t: "param" } | { t: "lit"; v: unknown } | { t: "op"; v: string } | { t: "word"; v: string } | { t: "(" } | { t: ")" } | { t: "," };

function tokenize(sqlText: string): Token[] {
  const tokens: Token[] = [];
  const re = /^\s*(?:`([^`]+)`\.`([^`]+)`|`([^`]+)`|(\?)|(-?\d+(?:\.\d+)?)|'((?:[^']|'')*)'|(<>|!=|>=|<=|=|>|<)|(\()|(\))|(,)|([a-zA-Z_]+))/;
  let match: RegExpExecArray | null;
  let index = 0;
  while (index < sqlText.length && (match = re.exec(sqlText.slice(index)))) {
    index += match[0].length;
    if (match[1]) tokens.push({ t: "col", table: match[1], col: match[2] });
    else if (match[3]) tokens.push({ t: "col", table: "", col: match[3] });
    else if (match[4]) tokens.push({ t: "param" });
    else if (match[5]) tokens.push({ t: "lit", v: Number(match[5]) });
    else if (match[6] != null) tokens.push({ t: "lit", v: match[6].replaceAll("''", "'") });
    else if (match[7]) tokens.push({ t: "op", v: match[7] });
    else if (match[8]) tokens.push({ t: "(" });
    else if (match[9]) tokens.push({ t: ")" });
    else if (match[10]) tokens.push({ t: "," });
    else if (match[11]) tokens.push({ t: "word", v: match[11].toLowerCase() });
    if (sqlText.slice(index).trim() === "") break;
  }
  return tokens;
}

type Pred = (row: Row) => boolean;

function compile(sqlText: string, params: unknown[], keyFor: (col: string) => string): Pred {
  const tokens = tokenize(sqlText);
  let pos = 0;
  let paramIndex = 0;
  const peek = () => tokens[pos];
  const word = (v: string) => { const tk = peek(); return tk?.t === "word" && tk.v === v; };
  const expect = (kind: Token["t"]) => { const tk = tokens[pos++]; if (tk?.t !== kind) throw new Error(`memoryDb: expected ${kind} in ${sqlText}`); return tk; };
  const value = (): unknown => {
    const tk = tokens[pos++];
    if (tk?.t === "param") return params[paramIndex++];
    if (tk?.t === "lit") return tk.v;
    if (tk?.t === "word" && (tk.v === "true" || tk.v === "false")) return tk.v === "true";
    if (tk?.t === "word" && tk.v === "null") return null;
    throw new Error(`memoryDb: unsupported value in ${sqlText}`);
  };
  const norm = (v: unknown) => typeof v === "boolean" ? (v ? 1 : 0) : v;
  const orExpr = (): Pred => {
    const parts = [andExpr()];
    while (word("or")) { pos++; parts.push(andExpr()); }
    return (row) => parts.some((part) => part(row));
  };
  const andExpr = (): Pred => {
    const parts = [unary()];
    while (word("and")) { pos++; parts.push(unary()); }
    return (row) => parts.every((part) => part(row));
  };
  const unary = (): Pred => {
    if (word("not")) { pos++; const inner = unary(); return (row) => !inner(row); }
    if (peek()?.t === "(") { pos++; const inner = orExpr(); expect(")"); return inner; }
    return comparison();
  };
  const comparison = (): Pred => {
    const colTok = expect("col") as Extract<Token, { t: "col" }>;
    const key = keyFor(colTok.col);
    const get = (row: Row) => norm(row[key] ?? null);
    if (word("is")) {
      pos++;
      const negate = word("not") ? (pos++, true) : false;
      if (!word("null")) throw new Error(`memoryDb: unsupported IS in ${sqlText}`);
      pos++;
      return (row) => (get(row) == null) !== negate;
    }
    const negateIn = word("not") ? (pos++, true) : false;
    if (word("in")) {
      pos++;
      expect("(");
      const values: unknown[] = [value()];
      while (peek()?.t === ",") { pos++; values.push(value()); }
      expect(")");
      const set = values.map(norm);
      return (row) => set.includes(get(row)) !== negateIn;
    }
    const opTok = expect("op") as Extract<Token, { t: "op" }>;
    const rhs = norm(value());
    switch (opTok.v) {
      case "=": return (row) => get(row) === rhs;
      case "<>": case "!=": return (row) => get(row) !== rhs;
      case ">": return (row) => get(row) != null && (get(row) as any) > (rhs as any);
      case ">=": return (row) => get(row) != null && (get(row) as any) >= (rhs as any);
      case "<": return (row) => get(row) != null && (get(row) as any) < (rhs as any);
      case "<=": return (row) => get(row) != null && (get(row) as any) <= (rhs as any);
    }
    throw new Error(`memoryDb: unsupported operator ${opTok.v}`);
  };
  const pred = orExpr();
  if (pos !== tokens.length) throw new Error(`memoryDb: could not parse ${sqlText}`);
  return pred;
}

function columnMaps(table: Table) {
  const byName = new Map<string, string>();
  const defaults: Row = {};
  for (const [key, column] of Object.entries(getTableColumns(table)) as Array<[string, any]>) {
    byName.set(column.name, key);
    if (column.hasDefault && column.default !== undefined && typeof column.default !== "object") defaults[key] = column.default;
    else if (column.hasDefault && Array.isArray(column.default)) defaults[key] = [...column.default];
    else defaults[key] = null;
  }
  return { byName, defaults };
}

export interface MemoryDb {
  db: any;
  rows(table: Table): Row[];
  seed(table: Table, ...rows: Row[]): Row[];
  /** Every statement in order: kind + table name, for "no write"/"no update" assertions. */
  log: Array<{ kind: "select" | "insert" | "update" | "delete"; table: string }>;
}

export function createMemoryDb(): MemoryDb {
  let store = new Map<Table, Row[]>();
  const nextId = new Map<Table, number>();
  const log: MemoryDb["log"] = [];
  const rowsOf = (table: Table) => { if (!store.has(table)) store.set(table, []); return store.get(table)!; };
  const predicate = (table: Table, condition: unknown): Pred => {
    if (!condition) return () => true;
    const { sql: text, params } = dialect.sqlToQuery(condition as any);
    const { byName } = columnMaps(table);
    return compile(text, params, (col) => byName.get(col) ?? col);
  };
  const insertRows = (table: Table, values: Row | Row[]) => {
    const { defaults } = columnMaps(table);
    const list = Array.isArray(values) ? values : [values];
    let insertId = 0;
    for (const value of list) {
      const id = value.id ?? (nextId.get(table) ?? Math.max(0, ...rowsOf(table).map((row) => row.id ?? 0)) + 1);
      nextId.set(table, Math.max(id + 1, nextId.get(table) ?? 0));
      const row = { ...structuredClone(defaults), ...structuredClone(value), id };
      rowsOf(table).push(row);
      if (!insertId) insertId = id;
    }
    return { insertId, affectedRows: list.length };
  };

  const db: any = {
    select(fields?: Record<string, any>) {
      return {
        from(table: Table) {
          let where: unknown;
          let order: Array<{ key: string; dir: 1 | -1 }> = [];
          let limitN: number | null = null;
          const run = () => {
            log.push({ kind: "select", table: getTableName(table) });
            const pred = predicate(table, where);
            let result = rowsOf(table).filter(pred);
            if (order.length) result = [...result].sort((a, b) => {
              for (const { key, dir } of order) { if (a[key] === b[key]) continue; return (a[key] > b[key] ? 1 : -1) * dir; }
              return 0;
            });
            if (limitN != null) result = result.slice(0, limitN);
            const cloned = structuredClone(result);
            if (!fields) return cloned;
            return cloned.map((row) => Object.fromEntries(Object.entries(fields).map(([alias, column]) => [alias, row[(Object.entries(getTableColumns(table)).find(([, c]) => c === column)?.[0]) ?? alias]])));
          };
          const query: any = {
            where(condition: unknown) { where = condition; return query; },
            orderBy(...specs: unknown[]) {
              const { byName } = columnMaps(table);
              order = specs.map((spec) => {
                const { sql: text } = dialect.sqlToQuery(spec as any);
                const m = /`([^`]+)`(?:\s+(asc|desc))?$/.exec(text.trim());
                if (m) return { key: byName.get(m[1]) ?? m[1], dir: m[2] === "desc" ? -1 as const : 1 as const };
                const column = Object.entries(getTableColumns(table)).find(([, c]) => c === spec)?.[0];
                return { key: column ?? "id", dir: 1 as const };
              });
              return query;
            },
            limit(n: number) { limitN = n; return query; },
            for() { return query; },
            then(resolve: any, reject: any) { return Promise.resolve().then(run).then(resolve, reject); },
          };
          return query;
        },
      };
    },
    insert(table: Table) {
      return {
        values(values: Row | Row[]) {
          log.push({ kind: "insert", table: getTableName(table) });
          const result = insertRows(table, values);
          const promise: any = Promise.resolve([result]);
          promise.onDuplicateKeyUpdate = () => promise;
          return promise;
        },
      };
    },
    update(table: Table) {
      return {
        set(values: Row) {
          return {
            where(condition: unknown) {
              log.push({ kind: "update", table: getTableName(table) });
              const pred = predicate(table, condition);
              let affectedRows = 0;
              for (const row of rowsOf(table)) if (pred(row)) { Object.assign(row, structuredClone(values)); affectedRows++; }
              return Promise.resolve([{ affectedRows }]);
            },
          };
        },
      };
    },
    delete(table: Table) {
      return {
        where(condition: unknown) {
          log.push({ kind: "delete", table: getTableName(table) });
          const pred = predicate(table, condition);
          const keep = rowsOf(table).filter((row) => !pred(row));
          const affectedRows = rowsOf(table).length - keep.length;
          store.set(table, keep);
          return Promise.resolve([{ affectedRows }]);
        },
      };
    },
    async transaction<T>(action: (tx: any) => Promise<T>): Promise<T> {
      const before = new Map(Array.from(store.entries()).map(([table, rows]) => [table, structuredClone(rows)] as [Table, Row[]]));
      try { return await action(db); } catch (error) { store = before; throw error; }
    },
    async execute() { return [[]]; },
  };
  return {
    db,
    log,
    rows: (table) => rowsOf(table),
    seed: (table, ...rows) => { for (const row of rows) insertRows(table, row); return rowsOf(table); },
  };
}
