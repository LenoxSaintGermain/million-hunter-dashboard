import mysql from "mysql2/promise";

const FIXTURE = {
  openId: "uat_jim_capital_20260813",
  email: "jim-capital-uat@invalid.local",
  name: "Jim Capital UAT",
};
const WINGATE_COMPILATION_ID = 270001;
const OWNER_USER_ID = 1;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to provision the UAT fixture.");
}

const db = await mysql.createConnection(process.env.DATABASE_URL);

try {
  await db.beginTransaction();
  await db.execute(
    `INSERT INTO users (openId, name, email, loginMethod, role, onboarding_completed, default_workspace, createdAt, updatedAt, lastSignedIn)
     VALUES (?, ?, ?, 'fixture', 'admin', 1, 'capital_aperture', NOW(), NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       email = VALUES(email),
       role = 'admin',
       onboarding_completed = 1,
       default_workspace = 'capital_aperture',
       updatedAt = NOW()`,
    [FIXTURE.openId, FIXTURE.name, FIXTURE.email],
  );

  const [[fixtureUser]] = await db.execute(
    "SELECT id, role, onboarding_completed, default_workspace FROM users WHERE openId = ? LIMIT 1",
    [FIXTURE.openId],
  );

  if (!fixtureUser) throw new Error("Fixture user could not be loaded after provisioning.");

  const [[thesis]] = await db.execute(
    "SELECT id FROM thesis_compilations WHERE id = ? LIMIT 1",
    [WINGATE_COMPILATION_ID],
  );
  if (!thesis) throw new Error(`Canonical Wingate thesis ${WINGATE_COMPILATION_ID} is missing.`);

  await db.execute(
    `INSERT INTO thesis_shares (compilation_id, user_id, shared_by_user_id, permission, created_at)
     VALUES (?, ?, ?, 'use', ?)
     ON DUPLICATE KEY UPDATE permission = 'use', shared_by_user_id = VALUES(shared_by_user_id)`,
    [WINGATE_COMPILATION_ID, fixtureUser.id, OWNER_USER_ID, Date.now()],
  );

  const [[visibleThesis]] = await db.execute(
    `SELECT tc.id, tc.name, ts.permission
     FROM thesis_compilations tc
     INNER JOIN thesis_shares ts ON ts.compilation_id = tc.id
     WHERE ts.user_id = ? AND tc.id = ? LIMIT 1`,
    [fixtureUser.id, WINGATE_COMPILATION_ID],
  );

  if (!visibleThesis) throw new Error("The Wingate shared-thesis fixture was not visible to the UAT user.");

  await db.commit();
  console.log(JSON.stringify({
    fixtureUser: { id: fixtureUser.id, ...FIXTURE, role: fixtureUser.role, onboardingCompleted: Boolean(fixtureUser.onboarding_completed), defaultWorkspace: fixtureUser.default_workspace },
    visibleThesis,
    expectedRoot: "/aperture",
  }, null, 2));
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  db.destroy();
}
