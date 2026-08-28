export function matchesInviteRecipient(
  recipientEmail: string | null | undefined,
  signedInEmail: string | null | undefined,
): boolean {
  if (!recipientEmail) return true;
  return recipientEmail.trim().toLowerCase() === signedInEmail?.trim().toLowerCase();
}
export function capitalOperatorInviteProfile(assignRole: string, label: string | null | undefined) {
  if (assignRole !== "capital_operator") return {};
  return {
    defaultWorkspace: "capital_aperture_trader" as const,
    onboardingCompleted: true,
    ...(label ? { name: label } : {}),
  };
}
