import { mkdtemp, open, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
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

  it("validates a package larger than 2 GiB without reading the whole zip", async () => {
    const original = await readFile(
      path.join(fixturesPath, "package", "valid-package.ocx.zip"),
    );
    const endOffset = original.lastIndexOf(
      Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    );
    const centralOffset = original.readUInt32LE(endOffset + 16);
    const centralSize = original.readUInt32LE(endOffset + 12);
    const entryCount = original.readUInt16LE(endOffset + 10);
    const fillerName = Buffer.from("unlisted-large-asset.bin");
    const fillerSize = 2 ** 31;
    const localHeader = Buffer.alloc(30 + fillerName.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt32LE(fillerSize, 18);
    localHeader.writeUInt32LE(fillerSize, 22);
    localHeader.writeUInt16LE(fillerName.length, 26);
    fillerName.copy(localHeader, 30);

    const centralHeader = Buffer.alloc(46 + fillerName.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt32LE(fillerSize, 20);
    centralHeader.writeUInt32LE(fillerSize, 24);
    centralHeader.writeUInt16LE(fillerName.length, 28);
    centralHeader.writeUInt32LE(centralOffset, 42);
    fillerName.copy(centralHeader, 46);

    const newCentralOffset = centralOffset + localHeader.length + fillerSize;
    const endRecord = Buffer.from(original.subarray(endOffset));
    endRecord.writeUInt16LE(entryCount + 1, 8);
    endRecord.writeUInt16LE(entryCount + 1, 10);
    endRecord.writeUInt32LE(centralSize + centralHeader.length, 12);
    endRecord.writeUInt32LE(newCentralOffset, 16);

    const directory = await mkdtemp(path.join(tmpdir(), "ocx-large-zip-"));
    const zipPath = path.join(directory, "large.ocx.zip");
    try {
      const file = await open(zipPath, "w+");
      try {
        await file.write(
          original.subarray(0, centralOffset),
          0,
          centralOffset,
          0,
        );
        await file.write(localHeader, 0, localHeader.length, centralOffset);
        await file.truncate(newCentralOffset);
        await file.write(
          original.subarray(centralOffset, endOffset),
          0,
          centralSize,
          newCentralOffset,
        );
        await file.write(
          centralHeader,
          0,
          centralHeader.length,
          newCentralOffset + centralSize,
        );
        await file.write(
          endRecord,
          0,
          endRecord.length,
          newCentralOffset + centralSize + centralHeader.length,
        );
      } finally {
        await file.close();
      }

      const result = await validatePackage(zipPath);
      expect(result).toEqual({ valid: true, errors: [] });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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

  describe("content validation", () => {
    it("validates valid LMS Activity content when flag is set", async () => {
      const result = await validatePackage(
        path.join(fixturesPath, "package", "lms-activity-valid.ocx.zip"),
        { validateContent: true },
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("detects invalid LMS Activity content", async () => {
      const result = await validatePackage(
        path.join(
          fixturesPath,
          "package",
          "lms-activity-invalid-content.ocx.zip",
        ),
        { validateContent: true },
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.type === "content")).toBe(true);
      const contentError = result.errors.find((e) => e.type === "content");
      expect(contentError?.message).toContain(
        "application/vnd.ocx.lmsActivity+json",
      );
      expect(contentError?.details).toHaveProperty("validationErrors");
    });

    it("detects missing LMS Activity content file", async () => {
      const result = await validatePackage(
        path.join(fixturesPath, "package", "lms-activity-missing-file.ocx.zip"),
        { validateContent: true },
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.type === "content")).toBe(true);
      const contentError = result.errors.find((e) => e.type === "content");
      expect(contentError?.message).toContain("not found");
      expect(contentError?.message).toContain("missing-quiz.lmsActivity.json");
    });

    it("skips content validation when flag is not set", async () => {
      const result = await validatePackage(
        path.join(
          fixturesPath,
          "package",
          "lms-activity-invalid-content.ocx.zip",
        ),
        { validateContent: false },
      );

      // Should not report content errors when flag is off
      expect(result.errors.some((e) => e.type === "content")).toBe(false);
    });

    it("skips content validation when options not provided", async () => {
      const result = await validatePackage(
        path.join(
          fixturesPath,
          "package",
          "lms-activity-invalid-content.ocx.zip",
        ),
      );

      // Should not report content errors when options omitted
      expect(result.errors.some((e) => e.type === "content")).toBe(false);
    });

    it("includes correct error details for content validation failures", async () => {
      const result = await validatePackage(
        path.join(
          fixturesPath,
          "package",
          "lms-activity-invalid-content.ocx.zip",
        ),
        { validateContent: true },
      );

      const contentError = result.errors.find((e) => e.type === "content");
      expect(contentError).toBeDefined();
      expect(contentError?.path).toBe("activities/quiz.lmsActivity.json");
      expect(contentError?.details).toHaveProperty("representationId");
      expect(contentError?.details).toHaveProperty(
        "encodingFormat",
        "application/vnd.ocx.lmsActivity+json",
      );
      expect(contentError?.details).toHaveProperty("parentPath");
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
