import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const REQUIRED_FIREBASE_BUILD_INPUTS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

describe("production Firebase build contract", () => {
  it("fails the container build when a required Firebase identifier is empty", () => {
    const dockerfile = readFileSync(`${process.cwd()}/Dockerfile`, "utf8");

    for (const input of REQUIRED_FIREBASE_BUILD_INPUTS) {
      expect(dockerfile).toContain(`test -n "$${input}"`);
    }
  });

  it("fails Cloud Build before Docker when a required Firebase identifier is empty", () => {
    const cloudBuild = readFileSync(
      `${process.cwd()}/cloudbuild.capital-aperture.yaml`,
      "utf8",
    );

    expect(cloudBuild).toContain("Required Firebase build input is missing");
    for (const input of REQUIRED_FIREBASE_BUILD_INPUTS) {
      expect(cloudBuild).toContain(`${input}=\${_${input}}`);
    }
  });
});
