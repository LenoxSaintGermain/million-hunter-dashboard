/** Validate retained recovery bytes and a successful isolated restore receipt. */
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { REVIEWED_PLAN_SHA256 } from './aperture-release-executor.mjs';
const digest = value => createHash('sha256').update(value).digest('hex');
function privateBytes(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw Error('Recovery material must be private and owned');
  return readFileSync(path);
}
export function verifiedRecovery({ artifactPath, proofPath, artifactSha256, proofSha256, expectedTarget }) {
  return async context => {
    if (context.expectedTarget !== expectedTarget || context.planSha256 !== REVIEWED_PLAN_SHA256) return false;
    const artifactBytes = privateBytes(artifactPath), proofBytes = privateBytes(proofPath);
    if (digest(artifactBytes) !== artifactSha256 || digest(proofBytes) !== proofSha256) return false;
    const artifact = JSON.parse(artifactBytes), proof = JSON.parse(proofBytes);
    if (artifact.targetFingerprint !== expectedTarget || proof.targetFingerprint !== expectedTarget ||
        proof.artifactSha256 !== artifactSha256 || proof.capturedAt !== artifact.capturedAt ||
        proof.restoreVerified !== true || proof.databaseRemoved !== true || proof.userRemoved !== true) return false;
    const names = ['aperture_decision_runs', 'aperture_decision_revisions'];
    return artifact.tables?.length === 2 && proof.tables?.length === 2 && names.every((name, index) =>
      artifact.tables[index].table === name && proof.tables[index].table === name &&
      proof.tables[index].matched === true && proof.tables[index].rows === artifact.tables[index].rows.length);
  };
}
