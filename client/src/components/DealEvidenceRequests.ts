type IntentStorage = Pick<Storage, "getItem" | "setItem">;
const inFlight = new WeakMap<IntentStorage, Map<string, Promise<unknown>>>();
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Per-tab retry journal. No payloads, auth tokens or outputs; never expires unresolved requests. */
export function createDealEvidenceRequests(
  scope: { ownerId: number; dealId: number },
  providedStorage?: IntentStorage
) {
  if (
    ![scope.ownerId, scope.dealId].every(
      value => Number.isSafeInteger(value) && value > 0
    )
  )
    throw new Error("Verified owner and deal are required for retry identity.");
  const namespace = `sh:deal-evidence:intents:v1:${scope.ownerId}:${scope.dealId}`;
  const storage = () => providedStorage || window.sessionStorage;
  function read(store: IntentStorage): Record<string, string> {
    const raw = store.getItem(namespace);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      Object.entries(parsed).some(
        ([, value]) => typeof value !== "string" || !uuid.test(value)
      )
    )
      throw new Error(
        "Retry identity journal is invalid; reconcile saved runs before retrying."
      );
    return parsed as Record<string, string>;
  }
  return {
    async submit<T>(
      key: string,
      invoke: (requestId: string) => Promise<T>,
      terminal: (value: T) => boolean = () => true
    ): Promise<T> {
      const store = storage();
      let pending = inFlight.get(store);
      if (!pending) {
        pending = new Map();
        inFlight.set(store, pending);
      }
      const flightKey = `${namespace}:${key}`;
      const existing = pending.get(flightKey);
      if (existing) return existing as Promise<T>;
      const journal = read(store);
      const requestId = journal[key] || crypto.randomUUID();
      // Persist before any mutation: storage failure must not start a paid execution.
      store.setItem(
        namespace,
        JSON.stringify({ ...journal, [key]: requestId })
      );
      const operation = Promise.resolve()
        .then(() => invoke(requestId))
        .then(result => {
          if (terminal(result)) {
            const latest = read(store);
            if (latest[key] === requestId) {
              delete latest[key];
              store.setItem(namespace, JSON.stringify(latest));
            }
          }
          return result;
        })
        .finally(() => pending!.delete(flightKey));
      pending.set(flightKey, operation);
      return operation;
    },
    /** A confirmed saved terminal result also resolves a previously lost response. */
    reconcile(requestIds: readonly string[]) {
      if (!requestIds.length) return;
      const store = storage();
      const journal = read(store);
      let changed = false;
      for (const [key, id] of Object.entries(journal))
        if (requestIds.includes(id)) {
          delete journal[key];
          changed = true;
        }
      if (changed) store.setItem(namespace, JSON.stringify(journal));
    },
  };
}
