import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconDir = path.join(root, "src-tauri", "icons");

function roundedAlpha(png) {
  const radius = Math.max(2, Math.round(Math.min(png.width, png.height) * 0.2));
  const edge = radius - 0.5;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const dx = Math.max(0, edge - x, x - (png.width - 1 - edge));
      const dy = Math.max(0, edge - y, y - (png.height - 1 - edge));
      const distance = Math.hypot(dx, dy);
      const mask =
        distance <= 0
          ? 255
          : distance >= radius
            ? 0
            : Math.round((radius - distance) * 255);
      const offset = (y * png.width + x) * 4 + 3;
      png.data[offset] = Math.min(png.data[offset], mask);
    }
  }
  return png;
}

function normalizePng(file) {
  const png = roundedAlpha(PNG.sync.read(fs.readFileSync(file)));
  fs.writeFileSync(file, PNG.sync.write(png));
}

function normalizeIco(file) {
  const source = fs.readFileSync(file);
  const count = source.readUInt16LE(4);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    const entryOffset = 6 + index * 16;
    const size = source.readUInt32LE(entryOffset + 8);
    const offset = source.readUInt32LE(entryOffset + 12);
    const png = roundedAlpha(
      PNG.sync.read(source.subarray(offset, offset + size)),
    );
    entries.push({
      header: source.subarray(entryOffset, entryOffset + 8),
      data: PNG.sync.write(png),
    });
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  let offset = 6 + count * 16;
  const directory = Buffer.alloc(count * 16);
  const payload = [];
  entries.forEach((entry, index) => {
    entry.header.copy(directory, index * 16, 0, 8);
    directory.writeUInt32LE(entry.data.length, index * 16 + 8);
    directory.writeUInt32LE(offset, index * 16 + 12);
    payload.push(entry.data);
    offset += entry.data.length;
  });
  fs.writeFileSync(file, Buffer.concat([header, directory, ...payload]));
}

for (const name of fs.readdirSync(iconDir)) {
  if (name.endsWith(".png")) normalizePng(path.join(iconDir, name));
}
for (const file of [
  path.join(iconDir, "icon.ico"),
  path.join(root, "src-tauri", "installer", "installer.ico"),
  path.join(root, "src-tauri", "installer", "uninstaller.ico"),
])
  normalizeIco(file);
