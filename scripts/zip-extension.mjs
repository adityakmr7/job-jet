#!/usr/bin/env node
/**
 * Zips apps/extension/dist into release/job-jet-extension-v<version>.zip for
 * upload to the Chrome Web Store. Run after a production build:
 *
 *   npm run release:extension   # builds (production) + zips
 *
 * Dependency-free: writes a standard ZIP (deflate) using node:zlib
 * (zlib.crc32 needs Node >= 22.2).
 */
import { crc32, deflateRawSync } from "node:zlib";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "apps/extension/dist");
const pkg = JSON.parse(readFileSync(join(root, "apps/extension/package.json"), "utf8"));

let manifest;
try {
  manifest = JSON.parse(readFileSync(join(distDir, "manifest.json"), "utf8"));
} catch {
  console.error("apps/extension/dist/manifest.json not found — run `npm run build -w apps/extension` first.");
  process.exit(1);
}
if (manifest.version !== pkg.version) {
  console.error(`dist manifest version ${manifest.version} != package.json version ${pkg.version}; rebuild first.`);
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// Skip source maps and OS junk — not needed in the store package.
const files = walk(distDir)
  .filter((f) => !f.endsWith(".map") && !f.endsWith(".DS_Store"))
  .sort();

// Fixed DOS timestamp (1980-01-01) so identical input gives identical zips.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

const localParts = [];
const centralParts = [];
let offset = 0;

for (const file of files) {
  const name = Buffer.from(relative(distDir, file).split(sep).join("/"), "utf8");
  const data = readFileSync(file);
  const compressed = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  localParts.push(local, name, compressed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  centralParts.push(central, name);

  offset += local.length + name.length + compressed.length;
}

const centralSize = centralParts.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

const outDir = join(root, "release");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `job-jet-extension-v${pkg.version}.zip`);
writeFileSync(outFile, Buffer.concat([...localParts, ...centralParts, end]));
console.log(`Wrote ${relative(root, outFile)} (${files.length} files)`);
