import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../client/src/index.css", import.meta.url), "utf8");
const block = (selector: string) => css.slice(css.indexOf(`${selector} {`)).split("}")[0];
const tokens = (source: string) => Object.fromEntries(Array.from(source.matchAll(/(--[\w-]+):\s*([^;]+);/g), match => [match[1], match[2].trim()]));
const workspace = tokens(block(".aperture-editorial"));

// XYZ Y is relative luminance. OKLCH conversion coefficients follow W3C CSS
// Color 4 sample code: https://www.w3.org/TR/css-color-4/#color-conversion-code
// These low-chroma palette colors are in gamut; this is not a gamut mapper.
function luminance(color: string): number {
  const values = color.match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/);
  if (!values) throw new Error(`Unsupported palette color: ${color}`);
  const [, lightness, chroma, hue] = values.map(Number);
  const a = chroma * Math.cos(hue * Math.PI / 180);
  const b = chroma * Math.sin(hue * Math.PI / 180);
  const l = (lightness + 0.3963377773761749 * a + 0.2158037573099136 * b) ** 3;
  const m = (lightness - 0.1055613458156586 * a - 0.0638541728258133 * b) ** 3;
  const s = (lightness - 0.0894841775298119 * a - 1.2914855480194092 * b) ** 3;
  return -0.0405757452148008 * l + 1.112286803280317 * m - 0.0717110580655164 * s;
}
function resolve(name: string, palette: Record<string, string>): string {
  const value = palette[name];
  if (!value) throw new Error(`Missing token: ${name}`);
  const alias = value.match(/^var\((--[\w-]+)\)$/);
  return alias ? resolve(alias[1], palette) : value;
}

describe("Aperture explanatory text contrast — opaque palette pairs, not full WCAG certification", () => {
  for (const theme of ["light", "dark"]) {
    for (const surface of ["--sh-bg", "--sh-surface-1", "--sh-surface", "--sh-surface-2", "--sh-surface-3"]) {
      it(`${theme} muted explanations meet 4.5:1 on ${surface}`, () => {
        const palette = { ...tokens(block(":root")), ...(theme === "dark" ? tokens(block(".dark")) : {}), ...workspace };
        const foreground = luminance(resolve("--sh-fg-muted", palette));
        const background = luminance(resolve(surface, palette));
        expect((Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
