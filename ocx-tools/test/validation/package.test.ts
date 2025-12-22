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

  it("detects duplicate @id values in package", async () => {
    const result = await validatePackage(
      path.join(fixturesPath, "package", "duplicate-ids.ocx.zip"),
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "duplicate")).toBe(true);
    const dupError = result.errors.find((e) => e.type === "duplicate");
    expect(dupError?.message).toContain("urn:ocx:duplicate-id");
    expect(dupError?.message).toContain("course.json");
    expect(dupError?.message).toContain("lesson.json");
    expect(dupError?.details).toHaveProperty(
      "duplicateId",
      "urn:ocx:duplicate-id",
    );
    expect(dupError?.details).toHaveProperty("files");
  });

  describe("reference validation", () => {
    it("passes validation for package with all references resolved", async () => {
      const result = await validatePackage(
        path.join(fixturesPath, "package", "valid-references.ocx.zip"),
        { checkReferences: true },
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("detects unresolved references", async () => {
      const result = await validatePackage(
        path.join(fixturesPath, "package", "invalid-references.ocx.zip"),
        { checkReferences: true },
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.type === "reference")).toBe(true);
      expect(
        result.errors.some((e) => e.message.includes("urn:ocx:missing-lg")),
      ).toBe(true);
    });

    it("skips reference validation when flag is not set", async () => {
      const result = await validatePackage(
        path.join(fixturesPath, "package", "invalid-references.ocx.zip"),
        { checkReferences: false },
      );

      // Should not report reference errors when flag is off
      expect(result.errors.some((e) => e.type === "reference")).toBe(false);
    });

    it("skips reference validation when options not provided", async () => {
      const result = await validatePackage(
        path.join(fixturesPath, "package", "invalid-references.ocx.zip"),
      );

      // Should not report reference errors when options omitted
      expect(result.errors.some((e) => e.type === "reference")).toBe(false);
    });

    it("includes correct error details for broken references", async () => {
      const result = await validatePackage(
        path.join(fixturesPath, "package", "invalid-references.ocx.zip"),
        { checkReferences: true },
      );

      const refError = result.errors.find((e) => e.type === "reference");
      expect(refError).toBeDefined();
      expect(refError?.path).toBe("course.json");
      expect(refError?.message).toContain("urn:ocx:missing-lg");
      expect(refError?.message).toContain("LessonGrouping");
      expect(refError?.message).toContain("hasPart");
      expect(refError?.details).toHaveProperty("referenceId");
      expect(refError?.details).toHaveProperty("referenceType");
      expect(refError?.details).toHaveProperty("property");
    });

    it("detects @type mismatch in references", async () => {
      const result = await validatePackage(
        path.join(fixturesPath, "package", "type-mismatch.ocx.zip"),
        { checkReferences: true },
      );

      expect(result.valid).toBe(false);
      const refError = result.errors.find((e) => e.type === "reference");
      expect(refError).toBeDefined();
      expect(refError?.message).toContain("Type mismatch");
      expect(refError?.message).toContain("urn:ocx:lesson-1");
      expect(refError?.message).toContain('expected "LessonGrouping"');
      expect(refError?.message).toContain('found "Lesson"');
      expect(refError?.details).toHaveProperty(
        "expectedType",
        "LessonGrouping",
      );
      expect(refError?.details).toHaveProperty("actualType", "Lesson");
    });
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
