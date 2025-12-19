import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execAsync = promisify(exec);

const CLI_PATH = path.join(
  __dirname,
  "..",
  "..",
  "src",
  "bin",
  "ocx-validate.ts",
);
const FIXTURES_PATH = path.join(__dirname, "..", "fixtures");

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execAsync(
      `npx tsx ${CLI_PATH} ${args.join(" ")}`,
      { cwd: path.join(__dirname, "..", "..") },
    );
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    const err = error as { stdout: string; stderr: string; code: number };
    return { stdout: err.stdout, stderr: err.stderr, exitCode: err.code };
  }
}

describe("ocx-validate CLI", () => {
  describe("help", () => {
    it("shows help with --help flag", async () => {
      const { stdout, exitCode } = await runCli(["--help"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("ocx-validate");
      expect(stdout).toContain("Usage:");
      expect(stdout).toContain("--json");
    });

    it("shows help with -h flag", async () => {
      const { stdout, exitCode } = await runCli(["-h"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Usage:");
    });
  });

  describe("no files", () => {
    it("exits with error when no files specified", async () => {
      const { stderr, exitCode } = await runCli([]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("No files specified");
    });
  });

  describe("validating OCX JSON files", () => {
    it("validates a valid OCX file", async () => {
      const validFile = path.join(
        FIXTURES_PATH,
        "ocx",
        "sample-course",
        "course.json",
      );
      const { stdout, exitCode } = await runCli([validFile]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("✓");
      expect(stdout).toContain("1/1 files valid");
    });

    it("validates multiple valid OCX files", async () => {
      const course = path.join(
        FIXTURES_PATH,
        "ocx",
        "sample-course",
        "course.json",
      );
      const lesson = path.join(
        FIXTURES_PATH,
        "ocx",
        "sample-course",
        "lesson-equations.json",
      );
      const { stdout, exitCode } = await runCli([course, lesson]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("2/2 files valid");
    });

    it("rejects an invalid OCX file", async () => {
      const invalidFile = path.join(
        FIXTURES_PATH,
        "package",
        "invalid-schema-package",
        "invalid-course.json",
      );
      const { stdout, exitCode } = await runCli([invalidFile]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain("✗");
      expect(stdout).toContain("[schema]");
      expect(stdout).toContain("0/1 files valid");
    });

    it("reports error for non-existent file", async () => {
      const { stdout, exitCode } = await runCli([
        "/non/existent/file.ocx.json",
      ]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain("✗");
      expect(stdout).toContain("[file]");
    });
  });

  describe("validating OCX packages (.ocx.zip)", () => {
    it("validates a valid OCX package", async () => {
      const validPackage = path.join(
        FIXTURES_PATH,
        "package",
        "valid-package.ocx.zip",
      );
      const { stdout, exitCode } = await runCli([validPackage]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("✓");
      expect(stdout).toContain("1/1 files valid");
    });

    it("rejects an invalid OCX package", async () => {
      const invalidPackage = path.join(
        FIXTURES_PATH,
        "package",
        "invalid-package.ocx.zip",
      );
      const { stdout, exitCode } = await runCli([invalidPackage]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain("✗");
    });

    it("rejects a package with schema errors", async () => {
      const invalidSchemaPackage = path.join(
        FIXTURES_PATH,
        "package",
        "invalid-schema.ocx.zip",
      );
      const { stdout, exitCode } = await runCli([invalidSchemaPackage]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain("✗");
      expect(stdout).toContain("[schema]");
    });
  });

  describe("unknown file types", () => {
    it("rejects files with unknown extensions", async () => {
      const unknownFile = path.join(
        FIXTURES_PATH,
        "manifest",
        "valid-manifest.json",
      );
      // This file doesn't end with .ocx.json but does end with .json,
      // so it will be treated as an OCX file and validated
      const { exitCode } = await runCli([unknownFile]);
      // The manifest file isn't valid OCX, so it should fail
      expect(exitCode).toBe(1);
    });
  });

  describe("--json output", () => {
    it("outputs valid JSON for a valid file", async () => {
      const validFile = path.join(
        FIXTURES_PATH,
        "ocx",
        "sample-course",
        "course.json",
      );
      const { stdout, exitCode } = await runCli(["--json", validFile]);

      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0].result.valid).toBe(true);
      expect(result[0].result.errors).toHaveLength(0);
    });

    it("outputs valid JSON for an invalid file", async () => {
      const invalidFile = path.join(
        FIXTURES_PATH,
        "package",
        "invalid-schema-package",
        "invalid-course.json",
      );
      const { stdout, exitCode } = await runCli(["--json", invalidFile]);

      expect(exitCode).toBe(1);
      const result = JSON.parse(stdout);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0].result.valid).toBe(false);
      expect(result[0].result.errors.length).toBeGreaterThan(0);
    });

    it("outputs valid JSON for multiple files", async () => {
      const validFile = path.join(
        FIXTURES_PATH,
        "ocx",
        "sample-course",
        "course.json",
      );
      const invalidFile = path.join(
        FIXTURES_PATH,
        "package",
        "invalid-schema-package",
        "invalid-course.json",
      );
      const { stdout, exitCode } = await runCli([
        "--json",
        validFile,
        invalidFile,
      ]);

      expect(exitCode).toBe(1);
      const result = JSON.parse(stdout);
      expect(result).toHaveLength(2);
      expect(result[0].result.valid).toBe(true);
      expect(result[1].result.valid).toBe(false);
    });

    it("includes file paths in JSON output", async () => {
      const validFile = path.join(
        FIXTURES_PATH,
        "ocx",
        "sample-course",
        "course.json",
      );
      const { stdout } = await runCli(["--json", validFile]);

      const result = JSON.parse(stdout);
      expect(result[0].file).toBe(validFile);
    });
  });

  describe("mixed valid and invalid files", () => {
    it("exits with error if any file is invalid", async () => {
      const validFile = path.join(
        FIXTURES_PATH,
        "ocx",
        "sample-course",
        "course.json",
      );
      const invalidFile = path.join(
        FIXTURES_PATH,
        "package",
        "invalid-schema-package",
        "invalid-course.json",
      );
      const { stdout, exitCode } = await runCli([validFile, invalidFile]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain("1/2 files valid");
    });

    it("shows both success and failure indicators", async () => {
      const validFile = path.join(
        FIXTURES_PATH,
        "ocx",
        "sample-course",
        "course.json",
      );
      const invalidFile = path.join(
        FIXTURES_PATH,
        "package",
        "invalid-schema-package",
        "invalid-course.json",
      );
      const { stdout } = await runCli([validFile, invalidFile]);

      expect(stdout).toContain("✓");
      expect(stdout).toContain("✗");
    });
  });
});
