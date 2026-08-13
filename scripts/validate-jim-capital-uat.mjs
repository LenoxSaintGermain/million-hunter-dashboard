import mysql from "mysql2/promise";

const FIXTURE_OPEN_ID = "uat_jim_capital_20260813";
const WINGATE_COMPILATION_ID = 270001;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to validate the UAT fixture.");

const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [[fixture]] = await db.execute(
    "SELECT id, role, onboarding_completed, default_workspace FROM users WHERE openId = ? LIMIT 1",
    [FIXTURE_OPEN_ID],
  );
  if (!fixture) throw new Error("Missing Jim-equivalent UAT fixture.");
  if (fixture.role !== "admin" || !fixture.onboarding_completed || fixture.default_workspace !== "capital_aperture") {
    throw new Error("Fixture does not match the required Capital Aperture stakeholder profile.");
  }

  const [[shared]] = await db.execute(
    `SELECT ts.permission
     FROM thesis_shares ts
     WHERE ts.user_id = ? AND ts.compilation_id = ? LIMIT 1`,
    [fixture.id, WINGATE_COMPILATION_ID],
  );
  if (!shared || shared.permission !== "use") throw new Error("Fixture cannot use the required shared canonical thesis.");

  console.log("Jim-equivalent UAT fixture is valid: root → /aperture; Wingate thesis visible with use access.");
} finally {
  db.destroy();
}
