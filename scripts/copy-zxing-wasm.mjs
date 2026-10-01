// Copies the zxing-wasm QR reader binary into public/, versioned, so the door
// scanner's iOS fallback loads it from this site instead of the jsDelivr CDN
// (barcode-detector's default) — one less third party between a queue and
// the door, on mobile data. Runs before `dev` and `build`.
//
// The file is resolved through barcode-detector (zxing-wasm is its
// dependency, not ours — pnpm does not hoist it), and its directory is named
// for the zxing-wasm version, which src/lib/qr-detector.ts reads from the same
// package at runtime. The JS and the WASM therefore cannot drift apart.
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const fromDetector = createRequire(require.resolve("barcode-detector"));

// zxing-wasm exports neither package.json nor the .wasm, so resolve a public
// entry and walk up to the package root.
let root = dirname(fromDetector.resolve("zxing-wasm/reader"));
while (!existsSync(join(root, "package.json")) ||
  JSON.parse(readFileSync(join(root, "package.json"), "utf8")).name !== "zxing-wasm") {
  const up = dirname(root);
  if (up === root) throw new Error("zxing-wasm package root not found");
  root = up;
}
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const source = join(root, "dist", "reader", "zxing_reader.wasm");

const outDir = join("public", "zxing", version);
const target = join(outDir, "zxing_reader.wasm");
if (!existsSync(target)) {
  mkdirSync(outDir, { recursive: true });
  copyFileSync(source, target);
}
console.log(`zxing-wasm ${version} -> ${target}`);
