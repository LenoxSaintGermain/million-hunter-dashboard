export async function readOptionalStatusSource<T>(name: string, read: () => Promise<T>): Promise<{ value: T | null; unavailable: string | null }> {
  try { return { value: await read(), unavailable: null }; }
  catch { return { value: null, unavailable: `${name} is unavailable. Unaffected records remain visible; related decisions need fresh verification.` }; }
}
