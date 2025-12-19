import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  SUPPORTED_FORMAT_RANGE,
  validateOcxFile,
  validatePackage,
} from "../../src/validation/package";

const fixturesPath = path.join(__dirname, "..", "fixtures");

describe("validatePackage", () => {
  it("validates a valid OCX package", async () => {
    const result = await validatePackage(
      path.join(fixturesPath, "package", "valid-package.ocx.zip"),
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a package with missing referenced files", async () => {
    const result = await validatePackage(
      path.join(fixturesPath, "package", "invalid-package.ocx.zip"),
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "file")).toBe(true);
    expect(
      result.errors.some((e) => e.message.includes("missing-file.json")),
    ).toBe(true);
  });

  it("rejects a package with unsupported version", async () => {
    const result = await validatePackage(
      path.join(fixturesPath, "package", "invalid-package.ocx.zip"),
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "version")).toBe(true);
  });

  it("rejects a package with invalid OCX schema", async () => {
    const result = await validatePackage(
      path.join(fixturesPath, "package", "invalid-schema.ocx.zip"),
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "schema")).toBe(true);
  });

  it("returns error for non-existent file", async () => {
    const result = await validatePackage("/non/existent/file.ocx.zip");

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe("file");
  });

  it("exports SUPPORTED_FORMAT_RANGE constant", () => {
    expect(SUPPORTED_FORMAT_RANGE).toBe("^1.0.0");
  });
});

describe("validateOcxFile", () => {
  it("validates a valid OCX file", async () => {
    const result = await validateOcxFile(
      path.join(fixturesPath, "ocx", "sample-course", "course.json"),
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects an invalid OCX file", async () => {
    const result = await validateOcxFile(
      path.join(
        fixturesPath,
        "package",
        "invalid-schema-package",
        "invalid-course.json",
      ),
    );

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe("schema");
  });

  it("returns error for non-existent file", async () => {
    const result = await validateOcxFile("/non/existent/file.ocx.json");

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe("file");
  });
});
