import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

await conn.execute(`
CREATE TABLE IF NOT EXISTS thesis_compilations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  thesis_text TEXT NOT NULL,
  template_used VARCHAR(64),
  compiled_filters JSON,
  scoring_weights JSON,
  evidence_requirements JSON,
  auto_disqualifiers JSON,
  confidence_notes JSON,
  estimated_targets_min INT,
  estimated_targets_max INT,
  estimated_cost_min INT,
  estimated_cost_max INT,
  status ENUM('compiling','review','approved','running','completed','archived') NOT NULL DEFAULT 'compiling',
  scan_job_id INT,
  name VARCHAR(256),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
`);

console.log("✓ thesis_compilations table created");
await conn.end();
