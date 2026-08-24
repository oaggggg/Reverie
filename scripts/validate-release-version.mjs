import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const tauri = JSON.parse(
  readFileSync(resolve(root, "src-tauri", "tauri.conf.json"), "utf8"),
);
const cargo = readFileSync(
  resolve(root, "src-tauri", "Cargo.toml"),
  "utf8",
).match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const tag = process.env.RELEASE_TAG;

if (!cargo) throw new Error("Could not read version from src-tauri/Cargo.toml");
if (pkg.version !== tauri.version || pkg.version !== cargo) {
  throw new Error(
    `Version mismatch: package.json=${pkg.version}, tauri.conf.json=${tauri.version}, Cargo.toml=${cargo}`,
  );
}
if (tag && tag !== `v${pkg.version}`) {
  throw new Error(
    `Release tag ${tag} does not match project version v${pkg.version}`,
  );
}

console.log(`Release version is consistent: v${pkg.version}`);
