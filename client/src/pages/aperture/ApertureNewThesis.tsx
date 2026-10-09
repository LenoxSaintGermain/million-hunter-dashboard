/**
 * New thesis inside the Capital shell (Refs #114): same nav and account strip
 * as the rest of the Capital workspace, same editor as /thesis?new=1.
 */
import ApertureShell from "@/components/aperture/ApertureShell";
import { CapitalThesisWorkspace } from "@/components/aperture/CapitalThesisWorkspace";

export default function ApertureNewThesis() {
  return (
    <ApertureShell>
      <CapitalThesisWorkspace />
    </ApertureShell>
  );
}
