import mysql from "mysql2/promise";

const OPEN_ID = "uat_ch_capital_9c18799";
const INVITE_TOKEN = "c".repeat(64);
function assertIsolatedDatabase(rawUrl) {
  const parsed = new URL(rawUrl);
  if (parsed.hostname !== "127.0.0.1" || parsed.port !== "3307" || parsed.pathname !== "/capital_aperture_uat_9c18799") {
    throw new Error("Refusing to validate against anything except the exact isolated CH Capital UAT database.");
  }
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
assertIsolatedDatabase(process.env.DATABASE_URL);
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [[user]] = await db.execute("SELECT id, role, onboarding_completed, default_workspace FROM users WHERE openId = ? LIMIT 1", [OPEN_ID]);
  if (!user || user.role !== "capital_operator" || !user.onboarding_completed || user.default_workspace !== "capital_aperture_trader") throw new Error("CH Capital UAT identity is not a bounded Capital Operator.");
  const [[account]] = await db.execute("SELECT id, broker_id, is_paper, sync_source, last_synced_at FROM portfolio_accounts WHERE user_id = ? AND label LIKE 'CH Capital%' LIMIT 1", [user.id]);
  if (!account || account.broker_id !== "manual" || !account.is_paper || account.sync_source !== "illustrative_uat_fixture" || !account.last_synced_at) throw new Error("CH Capital illustrative paper context is missing, stale, or mislabeled.");
  const [[positions]] = await db.execute("SELECT COUNT(*) AS count FROM positions WHERE account_id = ? AND price_source = 'illustrative_uat_fixture'", [account.id]);
  const [[plays]] = await db.execute("SELECT COUNT(*) AS count FROM aperture_active_play_contexts WHERE user_id = ? AND account_id = ? AND status = 'active'", [user.id, account.id]);
  const [[orders]] = await db.execute("SELECT COUNT(*) AS count FROM broker_orders WHERE user_id = ?", [user.id]);
  const [[invite]] = await db.execute("SELECT assign_role, label, recipient_email, consumed_at, expires_at FROM invite_tokens WHERE token = ? LIMIT 1", [INVITE_TOKEN]);
  if (Number(positions.count) < 2 || Number(plays.count) < 1) throw new Error("CH Capital portfolio/play fixture is incomplete.");
  if (Number(orders.count) !== 0) throw new Error("CH Capital fixture must start with zero broker orders.");
  if (!invite || invite.assign_role !== "capital_operator" || invite.label !== "CH Capital" || invite.consumed_at || !invite.expires_at) throw new Error("CH Capital pre-login invite fixture is incomplete or already consumed.");
  console.log(JSON.stringify({ identity: "ch_capital", role: user.role, defaultWorkspace: user.default_workspace, accountId: account.id, illustrativePositions: Number(positions.count), activePlayContexts: Number(plays.count), brokerOrders: 0, invite: { role: invite.assign_role, label: invite.label, consumed: false } }, null, 2));
} finally {
  await db.end();
}
