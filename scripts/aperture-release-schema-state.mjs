/** Inspect only the exact reviewed migration steps; no database writes. */
function parts(source) {
  const result = []; let start = 0, depth = 0, quote = null;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quote) { if (c === quote && source[i - 1] !== '\\') quote = null; continue; }
    if (c === "'" || c === '`') { quote = c; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) { result.push(source.slice(start, i).trim()); start = i + 1; }
  }
  result.push(source.slice(start).trim());
  return result;
}
const clean = value => String(value).replace(/`/g, '').trim();
const type = value => String(value).toLowerCase().replace(/\b(int|bigint)\(\d+\)/g, '$1').replace(/,\s+/g, ',');
const nullDefault = value => value == null || value === 'NULL';
const thesisDefault = value => value === 'thesis' || value === "'thesis'";
export function createdTableShape(sql) {
  const m = /^CREATE TABLE\s+`?(\w+)`?\s*\(([\s\S]*)\)\s*(?:ENGINE=InnoDB)?$/i.exec(sql);
  if (!m) throw Error('Not a reviewed CREATE TABLE shape');
  const columns = [], indexes = [];
  for (const part of parts(m[2])) {
    const key = /^(PRIMARY KEY|UNIQUE KEY|KEY)\s*(?:`?\w+`?\s*)?\(([^)]+)\)$/i.exec(part);
    if (key) { indexes.push({ unique: key[1] !== 'KEY', columns: parts(key[2]).map(clean) }); continue; }
    const c = /^`?(\w+)`?\s+(enum\([^)]*\)|varchar\(\d+\)|int|bigint|text|json)(?:\s+([\s\S]*))?$/i.exec(part);
    if (!c) throw Error(`Unrecognized column definition for ${m[1]}`);
    const primary = /PRIMARY KEY/i.test(c[3]);
    columns.push({ name: c[1], type: type(c[2]), nullable: !primary && !/NOT NULL/i.test(c[3]), auto: /AUTO_INCREMENT/i.test(c[3]) });
    if (primary) indexes.push({ unique: true, columns: [c[1]] });
  }
  return { table: m[1], columns, indexes };
}

export function inspectMigrationStep(step, schema) {
  const issues = [];
  const col = (table, name) => schema.columns.find(c => c.TABLE_NAME === table && c.COLUMN_NAME === name);
  const groups = new Map();
  for (const row of schema.statistics) {
    const key = `${row.TABLE_NAME}:${row.INDEX_NAME}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const keyExists = (table, names, unique = true) => [...groups.values()].some(rows => {
    const sorted = [...rows].sort((a,b) => Number(a.SEQ_IN_INDEX)-Number(b.SEQ_IN_INDEX));
    return sorted.length === names.length && sorted.every((r,i) => r.TABLE_NAME === table && r.COLUMN_NAME === names[i]
      && Number(r.NON_UNIQUE) === (unique ? 0 : 1) && r.SUB_PART == null && Number(r.SEQ_IN_INDEX) === i + 1);
  });
  let before = false, after = false;
  if (step.sql.startsWith('CREATE TABLE')) {
    const shape = createdTableShape(step.sql);
    before = !schema.tables.includes(shape.table);
    after = !before && schema.columns.filter(c => c.TABLE_NAME === shape.table).length === shape.columns.length
      && shape.columns.every(c => {
        const found = col(shape.table, c.name);
        const jsonAlias = c.type === 'json' && type(found?.COLUMN_TYPE) === 'longtext'
          && (schema.checks ?? []).some(check => check.TABLE_NAME === shape.table
            && String(check.CHECK_CLAUSE).replace(/[`\s]/g, '').toLowerCase() === `json_valid(${c.name})`);
        const matches = found && (type(found.COLUMN_TYPE) === c.type || jsonAlias) && found.IS_NULLABLE === (c.nullable ? 'YES' : 'NO')
          && /auto_increment/i.test(found.EXTRA ?? '') === c.auto && nullDefault(found.COLUMN_DEFAULT);
        if (!matches) issues.push({ column: `${shape.table}.${c.name}`, expected: c, observed: found ?? null });
        return matches;
      }) && shape.indexes.every(k => keyExists(shape.table, k.columns, k.unique));
  } else if (step.id === '0066_aperture_objective_mission.sql:1') {
    const table = 'aperture_decision_runs', context = col(table, 'context_kind'), request = col(table, 'client_request_id');
    const thesis = ['canonical_thesis_id', 'capital_thesis_id'].map(n => col(table,n));
    before = !context && !request && thesis.every(c => c && type(c.COLUMN_TYPE) === 'int' && c.IS_NULLABLE === 'NO');
    after = context?.IS_NULLABLE === 'NO' && thesisDefault(context.COLUMN_DEFAULT)
      && ["enum('thesis','objective')", "enum('thesis','objective','discovery')"].includes(type(context.COLUMN_TYPE))
      && type(request?.COLUMN_TYPE) === 'varchar(36)' && request?.IS_NULLABLE === 'YES'
      && thesis.every(c => c && type(c.COLUMN_TYPE) === 'int' && c.IS_NULLABLE === 'YES');
  } else if (step.id === '0066_aperture_objective_mission.sql:2') {
    const table = 'aperture_decision_runs', request = col(table,'client_request_id');
    const valid = type(request?.COLUMN_TYPE) === 'varchar(36)' && request?.IS_NULLABLE === 'YES';
    after = valid && keyExists(table,['user_id','client_request_id']);
    before = valid && !after && !schema.statistics.some(r => r.TABLE_NAME === table && r.INDEX_NAME === 'aperture_decision_runs_owner_request_uq');
  } else if (step.id === '0066_aperture_objective_mission.sql:3') {
    const c = col('aperture_decision_revisions','invalidation_rule');
    before = c && type(c.COLUMN_TYPE) === 'text' && c.IS_NULLABLE === 'NO';
    after = c && type(c.COLUMN_TYPE) === 'text' && c.IS_NULLABLE === 'YES';
  } else if (step.id === '0068_aperture_discovery_selection.sql:1') {
    const c = col('aperture_decision_runs','context_kind');
    before = c?.IS_NULLABLE === 'NO' && thesisDefault(c.COLUMN_DEFAULT) && type(c.COLUMN_TYPE) === "enum('thesis','objective')";
    after = c?.IS_NULLABLE === 'NO' && thesisDefault(c.COLUMN_DEFAULT) && type(c.COLUMN_TYPE) === "enum('thesis','objective','discovery')";
  } else throw Error('Unrecognized release statement');
  return { state: after ? 'after' : before ? 'before' : 'conflict', issues };
}
