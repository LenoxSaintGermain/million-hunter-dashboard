# Capital Projection Parser Recovery — UAT

## Reported Failure

The Capital / Trade projection mutation previously surfaced the raw compiler error: **“The thesis compiler did not return parseable JSON. Try again or simplify the thesis.”** This placed model-format recovery work on the operator.

## Repair

The compiler now reads JSON from direct text, Gemini candidate-part response objects, JSON-string payloads, and common structured response envelopes. If the first structured response is unreadable, it automatically makes one bounded JSON-only recovery attempt before returning a user-visible failure. The operator’s source thesis remains unchanged on a terminal failure.

## Browser Verification

From the authenticated Thesis Workspace, selecting **Use this saved thesis in Capital Aperture** for **Septic Route-Density Compounder** completed without a parser error. The resulting canonical-to-Capital record is **capital projection #120002**, in **review** state, with its update timestamp recorded after the browser action. No order or broker action occurred.
