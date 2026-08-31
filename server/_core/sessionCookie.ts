import { SESSION_COOKIE_NAMES } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";

export function readSessionCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const parsed = parseCookieHeader(cookieHeader);
  for (const cookieName of SESSION_COOKIE_NAMES) {
    const value = parsed[cookieName];
    if (value) return value;
  }
  return undefined;
}
