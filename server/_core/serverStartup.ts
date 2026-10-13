import type { Server } from "node:http";

/** Only development may probe or move ports. Production must bind PORT once. */
export async function resolveServerPort(
  env: { PORT?: string; NODE_ENV?: string },
  findAvailable: (port: number) => Promise<number>,
): Promise<number> {
  const raw = env.PORT ?? "3000";
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  const preferred = Number(raw);
  return env.NODE_ENV === "development" ? findAvailable(preferred) : preferred;
}

export function listenHttp(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(port, "0.0.0.0", () => {
      server.off("error", onError);
      resolve();
    });
  });
}
