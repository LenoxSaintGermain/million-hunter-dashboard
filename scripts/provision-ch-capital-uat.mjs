import mysql from "mysql2/promise";

const FIXTURE = {
  openId: "uat_ch_capital_9c18799",
  email: "ch-capital-uat@invalid.local",
  name: "CH Capital UAT",
  accountLabel: "CH Capital · illustrative paper context",
  inviteToken: "c".repeat(64),
  inviteEmail: "ch-capital-invite-uat@invalid.local",
};

function assertIsolatedDatabase(rawUrl) {
  const parsed = new URL(rawUrl);
  const database = parsed.pathname.replace(/^\//, "");
  if (parsed.hostname !== "127.0.0.1" || parsed.port !== "3307" || database !== "capital_aperture_uat_9c18799") {
    throw new Error("Refusing to provision CH Capital UAT outside the exact isolated loopback database.");
  }
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
assertIsolatedDatabase(process.env.DATABASE_URL);
const db = await mysql.createConnection(process.env.DATABASE_URL);

try {
  await db.beginTransaction();
  await db.execute(
    `INSERT INTO users (openId, name, email, loginMethod, role, onboarding_completed, default_workspace, createdAt, updatedAt, lastSignedIn)
     VALUES (?, ?, ?, 'fixture', 'capital_operator', 1, 'capital_aperture_trader', NOW(), NOW(), NOW())
     ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), role = 'capital_operator', onboarding_completed = 1, default_workspace = 'capital_aperture_trader', updatedAt = NOW()`,
    [FIXTURE.openId, FIXTURE.name, FIXTURE.email],
  );
  const [[user]] = await db.execute("SELECT id, role, default_workspace FROM users WHERE openId = ? LIMIT 1", [FIXTURE.openId]);
  if (!user) throw new Error("CH Capital fixture user was not created.");

  await db.execute(
    `INSERT INTO users (openId, name, email, loginMethod, role, onboarding_completed, default_workspace, createdAt, updatedAt, lastSignedIn)
     VALUES ('uat_ch_invite_admin_9c18799', 'CH Invite Admin UAT', 'ch-invite-admin-uat@invalid.local', 'fixture', 'admin', 1, 'command_center', NOW(), NOW(), NOW())
     ON DUPLICATE KEY UPDATE role = 'admin', updatedAt = NOW()`,
  );
  const [[inviteAdmin]] = await db.execute("SELECT id FROM users WHERE openId = 'uat_ch_invite_admin_9c18799' LIMIT 1");
  if (!inviteAdmin) throw new Error("CH Capital invite admin fixture was not created.");
  await db.execute("DELETE FROM invite_tokens WHERE token = ?", [FIXTURE.inviteToken]);
  await db.execute(
    `INSERT INTO invite_tokens (token, assign_role, label, recipient_email, created_by_user_id, expires_at, created_at)
     VALUES (?, 'capital_operator', 'CH Capital', ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY), NOW())`,
    [FIXTURE.inviteToken, FIXTURE.inviteEmail, inviteAdmin.id],
  );

  const now = Date.now();
  const [[existingAccount]] = await db.execute("SELECT id FROM portfolio_accounts WHERE user_id = ? AND label = ? ORDER BY id ASC LIMIT 1", [user.id, FIXTURE.accountLabel]);
  if (existingAccount) {
    await db.execute(
      `UPDATE portfolio_accounts SET broker_id = 'manual', is_paper = 1, cash_cents = 1000000, buying_power_cents = 1000000,
       equity_value_cents = 2500000, sync_source = 'illustrative_uat_fixture', sync_error = NULL, last_synced_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [now, now, existingAccount.id, user.id],
    );
  } else {
    await db.execute(
      `INSERT INTO portfolio_accounts (user_id, label, broker_id, is_paper, cash_cents, buying_power_cents, equity_value_cents, sync_source, sync_error, last_synced_at, created_at, updated_at)
       VALUES (?, ?, 'manual', 1, 1000000, 1000000, 2500000, 'illustrative_uat_fixture', NULL, ?, ?, ?)`,
      [user.id, FIXTURE.accountLabel, now, now, now],
    );
  }
  const [[account]] = await db.execute("SELECT id FROM portfolio_accounts WHERE user_id = ? AND label = ? ORDER BY id ASC LIMIT 1", [user.id, FIXTURE.accountLabel]);
  if (!account) throw new Error("CH Capital illustrative account was not created.");

  await db.execute("DELETE FROM positions WHERE account_id = ?", [account.id]);
  await db.execute(
    `INSERT INTO positions (account_id, symbol, asset_type, qty, avg_cost_cents, last_price_cents, market_value_cents, price_as_of, price_source, created_at, updated_at)
     VALUES (?, 'TLT', 'etf', 20, 9300, 9400, 188000, ?, 'illustrative_uat_fixture', ?, ?),
            (?, 'NVDA', 'equity', 5, 12000, 12500, 62500, ?, 'illustrative_uat_fixture', ?, ?)`,
    [account.id, now, now, now, account.id, now, now, now],
  );

  await db.execute("DELETE FROM aperture_active_play_contexts WHERE user_id = ? AND account_id = ?", [user.id, account.id]);
  await db.execute(
    `INSERT INTO aperture_active_play_contexts
      (user_id, account_id, symbol, side, status, thesis_note, horizon, entry_price_cents, stop_price_cents, target_price_cents, source, as_of, created_at, updated_at)
     VALUES (?, ?, 'TLT', 'long', 'active', ?, 'Illustrative swing UAT', 9300, 9100, 9800, 'manual', ?, ?, ?)`,
    [user.id, account.id, "Illustrative UAT only: test whether a new research mission recognizes an existing rate-sensitive paper position and its stated invalidation; this is not Akil's real play.", now, now, now],
  );

  const [[orders]] = await db.execute("SELECT COUNT(*) AS count FROM broker_orders WHERE user_id = ?", [user.id]);
  await db.commit();
  console.log(JSON.stringify({ fixture: { ...FIXTURE, inviteToken: `${FIXTURE.inviteToken.slice(0, 8)}…` }, user, accountId: account.id, positions: ["TLT", "NVDA"], activePlay: "TLT", brokerOrders: Number(orders.count), invite: { label: "CH Capital", role: "capital_operator", recipient: FIXTURE.inviteEmail, sent: false }, disclosure: "Illustrative isolated fixture; not Akil's portfolio and not a broker account." }, null, 2));
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
