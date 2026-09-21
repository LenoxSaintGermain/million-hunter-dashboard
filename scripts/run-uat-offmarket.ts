/** Retired: the former runner loaded production credentials and could approve
 * existing orders. Keep old handoff commands inert. History remains in Git.
 * Authenticated paper-order UAT is a separate, explicitly authorized journey.
 */
console.error("Off-market runner disabled: use DATABASE_URL= pnpm test:unit or the isolated integration harness. No accounts or orders were changed.");
process.exitCode = 1;
export {};
