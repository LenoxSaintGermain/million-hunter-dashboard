/** Presentation only; never grants or removes access. Missing profile stays secondary. */
export function prioritizesWingate(role?: string, profile?: { quizCompleted?: boolean; assetClass?: string | null } | null) {
  return role === "investor" && profile?.quizCompleted === true && profile.assetClass === "historic";
}
