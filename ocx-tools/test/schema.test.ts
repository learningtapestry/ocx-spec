import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import Ajv, { type ErrorObject } from "ajv";
import { describe, expect, it } from "vitest";

const schemaPath = path.join(__dirname, "..", "src", "ocx.schema.json");
const fixturesPath = path.join(__dirname, "fixtures", "ocx", "sample-course");
const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));

describe("OCX JSON Schema", () => {
  const ajv = new Ajv({ strict: false, allErrors: true });
  ajv.addFormat("date-time", {
    type: "string",
    validate: (value: string) => !Number.isNaN(Date.parse(value)),
  });
  const validate = ajv.compile(schema);

  it("loads and can be validated with Ajv", () => {
    expect(ajv.validateSchema(schema)).toBe(true);
    expect(ajv.errors).toBeNull();
  });

  it("validates example OCX instances", () => {
    const fixtureFiles = readdirSync(fixturesPath).filter((file) =>
      file.endsWith(".json"),
    );
    const invalid = fixtureFiles
      .map((file) => {
        const data = JSON.parse(
          readFileSync(path.join(fixturesPath, file), "utf-8"),
        );
        const valid = validate(data);
        return valid ? null : { file, errors: validate.errors ?? [] };
      })
      .filter(
        (result): result is { file: string; errors: ErrorObject[] } =>
          result !== null,
      );

    const messages = invalid.map(
      (result) =>
        `${result.file}: ${ajv.errorsText(result.errors, { separator: " | " })}`,
    );

    expect(messages).toHaveLength(0);
  });

  it("enforces link type constraints for OCX links", () => {
    const baseCourse = {
      "@id": "urn:ocx:course-test",
      "@type": "Course",
      audience: ["Teacher"],
      author: "Test Author",
      identifier: "course-test",
      license: "CC-BY",
      providerDateCreated: "2024-01-01T00:00:00Z",
      providerDateModified: "2024-01-02T00:00:00Z",
    };

    const validCourse = {
      ...baseCourse,
      hasPart: [{ link: { "@id": "urn:ocx:lg-1", "@type": "LessonGrouping" } }],
    };
    expect(validate(validCourse)).toBe(true);
    expect(validate.errors).toBeNull();

    const invalidCourse = {
      ...baseCourse,
      hasPart: [{ link: { "@id": "urn:ocx:lesson-1", "@type": "Lesson" } }],
    };
    expect(validate(invalidCourse)).toBe(false);
    expect(
      validate.errors?.some((error) => error.instancePath.endsWith("/@type")),
    ).toBe(true);
  });

  it("requires @id and @type", () => {
    const baseCourse = {
      "@id": "urn:ocx:course-required-fields",
      "@type": "Course",
      audience: ["Teacher"],
      author: "Test Author",
      identifier: "course-required-fields",
      license: "CC-BY",
      providerDateCreated: "2024-01-01T00:00:00Z",
      providerDateModified: "2024-01-02T00:00:00Z",
    };

    const { "@id": _dropId, ...withoutId } = baseCourse;
    expect(validate(withoutId)).toBe(false);
    expect(
      validate.errors?.some(
        (error) =>
          error.keyword === "required" &&
          error.params.missingProperty === "@id",
      ),
    ).toBe(true);

    const { "@type": _dropType, ...withoutType } = baseCourse;
    expect(validate(withoutType)).toBe(false);
    expect(
      validate.errors?.some(
        (error) =>
          error.keyword === "required" &&
          error.params.missingProperty === "@type",
      ),
    ).toBe(true);
  });

  it("validates Material with embedded Representation objects", () => {
    const materialWithRepresentations = {
      "@id": "urn:ocx:material-test",
      "@type": "Material",
      identifier: "material-test",
      name: "Test Material",
      audience: ["Student"],
      author: "Test Author",
      license: "CC-BY",
      content: "Test content",
      materialType: "Supporting",
      providerDateCreated: "2024-01-01T00:00:00Z",
      providerDateModified: "2024-02-01T00:00:00Z",
      hasRepresentation: [
        {
          "@id": "urn:ocx:rep-1",
          "@type": "Representation",
          identifier: "test.pdf",
          encodingFormat: "application/pdf",
          accessResource: "assets/test.pdf",
          preferred: true,
          isOcxGenerated: false,
          lmsLoadingGuidance: "Recommended",
        },
        {
          "@id": "urn:ocx:rep-2",
          "@type": "Representation",
          identifier: "test-es.pdf",
          encodingFormat: "application/pdf",
          accessResource: "assets/test-es.pdf",
          isOcxGenerated: true,
          inLanguage: "es-US",
          name: "Spanish PDF",
        },
      ],
    };
    expect(validate(materialWithRepresentations)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it("validates standalone Representation objects", () => {
    const representation = {
      "@id": "urn:ocx:rep-standalone",
      "@type": "Representation",
      identifier: "standalone.pdf",
      encodingFormat: "application/pdf",
      accessResource: "assets/standalone.pdf",
    };
    expect(validate(representation)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it("rejects Representation missing required fields", () => {
    const invalidRepresentation = {
      "@id": "urn:ocx:rep-invalid",
      "@type": "Representation",
      identifier: "invalid.pdf",
      // missing encodingFormat and accessResource
    };
    expect(validate(invalidRepresentation)).toBe(false);
  });
});
