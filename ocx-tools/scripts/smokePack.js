import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const smokeRoot = mkdtempSync(join(tmpdir(), "ocx-tools-smoke-"));
const cacheDir = join(smokeRoot, "npm-cache");
const projectDir = join(smokeRoot, "project");

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: options.cwd ?? packageRoot,
    env: {
      ...process.env,
      npm_config_cache: cacheDir,
    },
    stdio: "inherit",
  });
}

function output(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? packageRoot,
    env: {
      ...process.env,
      npm_config_cache: cacheDir,
    },
    encoding: "utf8",
  });
}

const packOutput = output("npm", [
  "pack",
  "--json",
  "--pack-destination",
  smokeRoot,
]);
const [{ filename }] = JSON.parse(packOutput);
const tarballPath = join(smokeRoot, filename);

writeFileSync(
  join(smokeRoot, "package.json"),
  JSON.stringify({ private: true, type: "module" }, null, 2),
);

run("npm", [
  "install",
  "--prefix",
  projectDir,
  "--ignore-scripts",
  "--no-audit",
  "--no-fund",
  tarballPath,
  "arktype@^2.1.28",
  "@types/node@^24.10.1",
]);

writeFileSync(
  join(projectDir, "runtime.mjs"),
  `import assert from "node:assert/strict";
import * as ocxTools from "@learningtapestry/ocx-tools";
import ocxSchema from "@learningtapestry/ocx-tools/ocx.schema.json" with { type: "json" };
import manifestSchema from "@learningtapestry/ocx-tools/manifest.schema.json" with { type: "json" };
import validateOcx from "@learningtapestry/ocx-tools/validation/ajv";
import validateManifest from "@learningtapestry/ocx-tools/validation/manifest-ajv";
import { validatePackage } from "@learningtapestry/ocx-tools/validation/package";
import ocxArk from "@learningtapestry/ocx-tools/validation/ark";
import { validateLmsActivity } from "@learningtapestry/ocx-tools/formats";
import validateLmsActivitySubpath from "@learningtapestry/ocx-tools/formats/lmsActivity-ajv";
import LmsActivityArk from "@learningtapestry/ocx-tools/formats/lmsActivity-ark";

assert.equal(typeof ocxTools, "object");
assert.equal(typeof ocxSchema.$schema, "string");
assert.equal(manifestSchema.type, "object");
assert.equal(typeof validateOcx, "function");
assert.equal(typeof validateManifest, "function");
assert.equal(typeof validatePackage, "function");
assert.equal(typeof ocxArk.OcxEntity, "function");
assert.equal(typeof validateLmsActivity, "function");
assert.equal(typeof validateLmsActivitySubpath, "function");
assert.equal(typeof LmsActivityArk, "function");
`,
);

writeFileSync(
  join(projectDir, "types.ts"),
  `import type { Course, Manifest } from "@learningtapestry/ocx-tools";
import type { LmsActivity } from "@learningtapestry/ocx-tools/formats/lmsActivity";

declare const course: Course;
declare const manifest: Manifest;
declare const activity: LmsActivity;

void course;
void manifest;
void activity;
`,
);

run(process.execPath, [join(projectDir, "runtime.mjs")]);

run(
  process.execPath,
  [
    join(packageRoot, "node_modules/typescript/bin/tsc"),
    "--noEmit",
    "--target",
    "ES2022",
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    "--strict",
    "types.ts",
  ],
  { cwd: projectDir },
);

run(process.execPath, [
  join(projectDir, "node_modules/.bin/ocx-validate"),
  "--help",
]);

console.log(`Packed package smoke test passed in ${projectDir}`);
