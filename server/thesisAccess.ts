/** A shared thesis never grants edit/delete authority; only a `use` grant may create a personal Capital projection. */
export function canUseCanonicalThesis(input: {
  ownerUserId: number;
  requesterUserId: number;
  sharedPermission?: "view" | "use" | null;
}) {
  return input.ownerUserId === input.requesterUserId || input.sharedPermission === "use";
}
