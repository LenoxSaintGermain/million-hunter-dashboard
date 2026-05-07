import "dotenv/config";
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log("Creating capital_flows table...");
await conn.execute(`
  CREATE TABLE IF NOT EXISTS capital_flows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source VARCHAR(64) NOT NULL COMMENT 'usaspending | federal_register | fec',
    entity VARCHAR(512) NOT NULL COMMENT 'Recipient or filing entity name',
    amount BIGINT COMMENT 'Dollar amount in cents (null for non-monetary flows)',
    geography VARCHAR(256) NOT NULL COMMENT 'State, city, or MSA',
    category VARCHAR(128) NOT NULL COMMENT 'infrastructure | defense | healthcare | housing | energy | education | other',
    flow_date DATE NOT NULL COMMENT 'Date of the award, notice, or disbursement',
    raw_title TEXT COMMENT 'Original title or description from source',
    source_url VARCHAR(1024) COMMENT 'Link to source record',
    confidence DECIMAL(4,3) NOT NULL DEFAULT 0.700 COMMENT 'TIDE-CLASSIFIER confidence 0-1',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_geography (geography),
    INDEX idx_category (category),
    INDEX idx_flow_date (flow_date),
    INDEX idx_source (source)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);
console.log("✓ capital_flows created");

console.log("Creating convergence_events table...");
await conn.execute(`
  CREATE TABLE IF NOT EXISTS convergence_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    geography VARCHAR(256) NOT NULL,
    signal_type VARCHAR(128) NOT NULL COMMENT 'infrastructure_surge | defense_pivot | housing_push | energy_transition | healthcare_expansion',
    flow_ids JSON NOT NULL COMMENT 'Array of capital_flow IDs that form this convergence',
    total_capital BIGINT COMMENT 'Sum of flow amounts in cents',
    window_days INT NOT NULL DEFAULT 90 COMMENT 'Days window used to detect convergence',
    thesis_seed TEXT COMMENT 'TIDE-LINKER generated thesis pre-compilation text',
    confidence DECIMAL(4,3) NOT NULL DEFAULT 0.700,
    status VARCHAR(32) NOT NULL DEFAULT 'active' COMMENT 'active | archived | converted_to_thesis',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_geography (geography),
    INDEX idx_signal_type (signal_type),
    INDEX idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);
console.log("✓ convergence_events created");

console.log("Creating tide_predictions table (track record log)...");
await conn.execute(`
  CREATE TABLE IF NOT EXISTS tide_predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    convergence_event_id INT COMMENT 'FK to convergence_events',
    claim TEXT NOT NULL COMMENT 'The specific prediction claim',
    geography VARCHAR(256) NOT NULL,
    category VARCHAR(128) NOT NULL,
    confidence DECIMAL(4,3) NOT NULL,
    predicted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    outcome VARCHAR(32) DEFAULT NULL COMMENT 'null | confirmed | disconfirmed | pending',
    outcome_note TEXT,
    outcome_at TIMESTAMP NULL,
    user_id INT NOT NULL,
    INDEX idx_geography (geography),
    INDEX idx_predicted_at (predicted_at),
    INDEX idx_outcome (outcome)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);
console.log("✓ tide_predictions created");

await conn.end();
console.log("\n✅ TIDE migration complete — 3 tables created");
