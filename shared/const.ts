export const COOKIE_NAME = "app_session_id";
export const HOSTED_SESSION_COOKIE_NAME = "__session";
export const SESSION_COOKIE_NAMES = [HOSTED_SESSION_COOKIE_NAME, COOKIE_NAME] as const;
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
