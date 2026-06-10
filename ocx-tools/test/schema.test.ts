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

  describe("Duration (ISO 8601) validation", () => {
    const baseActivity = {
      "@id": "urn:ocx:activity-duration-test",
      "@type": "Activity",
      identifier: "activity-duration-test",
      name: "Duration Test Activity",
      audience: ["Teacher"],
      author: "Test Author",
      license: "CC-BY",
      providerDateCreated: "2024-01-01T00:00:00Z",
      providerDateModified: "2024-02-01T00:00:00Z",
    };

    it.each([
      ["PT45M", "minutes only"],
      ["PT1H30M", "hours and minutes"],
      ["P1D", "days only"],
      ["P2W", "weeks only"],
      ["P1Y2M3DT4H5M6S", "full combined"],
      ["PT0.5S", "fractional seconds"],
    ])("accepts valid duration %s (%s)", (duration) => {
      expect(validate({ ...baseActivity, timeRequired: duration })).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it.each([
      ["45 minutes", "plain text"],
      ["P", "bare P with no components"],
      ["PT", "bare PT with no time components"],
      ["1H30M", "missing P prefix"],
      ["", "empty string"],
    ])("rejects invalid duration %s (%s)", (duration) => {
      expect(validate({ ...baseActivity, timeRequired: duration })).toBe(false);
      expect(
        validate.errors?.some((error) => error.keyword === "pattern"),
      ).toBe(true);
    });
  });

  it("allows Lesson to have Material in hasPart", () => {
    const baseLesson = {
      "@id": "urn:ocx:lesson-test",
      "@type": "Lesson",
      audience: ["Student"],
      author: "Test Author",
      identifier: "lesson-test",
      license: "CC-BY",
      providerDateCreated: "2024-01-01T00:00:00Z",
      providerDateModified: "2024-01-02T00:00:00Z",
    };

    // Lesson with embedded Material
    const lessonWithEmbeddedMaterial = {
      ...baseLesson,
      hasPart: [
        {
          "@id": "urn:ocx:material-1",
          "@type": "Material",
          identifier: "material-1",
          audience: ["Student"],
          author: "Test Author",
          license: "CC-BY",
          content: "<p>Test content</p>",
          materialType: "Supporting",
          providerDateCreated: "2024-01-01T00:00:00Z",
          providerDateModified: "2024-01-02T00:00:00Z",
        },
      ],
    };
    expect(validate(lessonWithEmbeddedMaterial)).toBe(true);
    expect(validate.errors).toBeNull();

    // Lesson with Material link
    const lessonWithMaterialLink = {
      ...baseLesson,
      "@id": "urn:ocx:lesson-test-2",
      hasPart: [{ link: { "@id": "urn:ocx:material-1", "@type": "Material" } }],
    };
    expect(validate(lessonWithMaterialLink)).toBe(true);
    expect(validate.errors).toBeNull();

    // Lesson with both Activity and Material
    const lessonWithActivityAndMaterial = {
      ...baseLesson,
      "@id": "urn:ocx:lesson-test-3",
      hasPart: [
        { link: { "@id": "urn:ocx:activity-1", "@type": "Activity" } },
        { link: { "@id": "urn:ocx:material-1", "@type": "Material" } },
      ],
    };
    expect(validate(lessonWithActivityAndMaterial)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it("allows curriculum containers and activities to have Assessment in hasPart", () => {
    const baseAssessment = {
      "@id": "urn:ocx:assessment-test",
      "@type": "Assessment",
      identifier: "assessment-test",
      name: "Assessment Test",
      audience: ["Student"],
      author: "Test Author",
      license: "CC-BY",
      educationalUse: "Assessment",
      providerDateCreated: "2024-01-01T00:00:00Z",
      providerDateModified: "2024-01-02T00:00:00Z",
    };

    const courseWithAssessment = {
      "@id": "urn:ocx:course-assessment-test",
      "@type": "Course",
      audience: ["Teacher"],
      author: "Test Author",
      identifier: "course-assessment-test",
      license: "CC-BY",
      providerDateCreated: "2024-01-01T00:00:00Z",
      providerDateModified: "2024-01-02T00:00:00Z",
      hasPart: [
        { link: { "@id": "urn:ocx:assessment-test", "@type": "Assessment" } },
      ],
    };
    expect(validate(courseWithAssessment)).toBe(true);
    expect(validate.errors).toBeNull();

    const lessonGroupingWithAssessment = {
      "@id": "urn:ocx:unit-assessment-test",
      "@type": "LessonGrouping",
      audience: ["Teacher"],
      author: "Test Author",
      identifier: "unit-assessment-test",
      groupLevel: 1,
      groupName: "Unit",
      license: "CC-BY",
      providerDateCreated: "2024-01-01T00:00:00Z",
      providerDateModified: "2024-01-02T00:00:00Z",
      hasPart: [
        { link: { "@id": "urn:ocx:assessment-test", "@type": "Assessment" } },
      ],
    };
    expect(validate(lessonGroupingWithAssessment)).toBe(true);
    expect(validate.errors).toBeNull();

    const lessonWithAssessment = {
      "@id": "urn:ocx:lesson-assessment-test",
      "@type": "Lesson",
      audience: ["Teacher"],
      author: "Test Author",
      identifier: "lesson-assessment-test",
      license: "CC-BY",
      providerDateCreated: "2024-01-01T00:00:00Z",
      providerDateModified: "2024-01-02T00:00:00Z",
      hasPart: [
        { link: { "@id": "urn:ocx:assessment-test", "@type": "Assessment" } },
      ],
    };
    expect(validate(lessonWithAssessment)).toBe(true);
    expect(validate.errors).toBeNull();

    const activityWithEmbeddedAssessment = {
      "@id": "urn:ocx:activity-assessment-test",
      "@type": "Activity",
      audience: ["Student"],
      author: "Test Author",
      identifier: "activity-assessment-test",
      license: "CC-BY",
      providerDateCreated: "2024-01-01T00:00:00Z",
      providerDateModified: "2024-01-02T00:00:00Z",
      hasPart: [baseAssessment],
    };
    expect(validate(activityWithEmbeddedAssessment)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it("allows Assessment to have Material in hasPart", () => {
    const assessmentWithMaterial = {
      "@id": "urn:ocx:assessment-with-material",
      "@type": "Assessment",
      identifier: "assessment-with-material",
      name: "Assessment With Material",
      audience: ["Student"],
      author: "Test Author",
      license: "CC-BY",
      educationalUse: "Assessment",
      providerDateCreated: "2024-01-01T00:00:00Z",
      providerDateModified: "2024-01-02T00:00:00Z",
      hasPart: [{ link: { "@id": "urn:ocx:material-1", "@type": "Material" } }],
    };

    expect(validate(assessmentWithMaterial)).toBe(true);
    expect(validate.errors).toBeNull();

    const assessmentWithInvalidPart = {
      ...assessmentWithMaterial,
      hasPart: [
        { link: { "@id": "urn:ocx:assessment-2", "@type": "Assessment" } },
      ],
    };

    expect(validate(assessmentWithInvalidPart)).toBe(false);
    expect(
      validate.errors?.some((error) => error.instancePath.endsWith("/@type")),
    ).toBe(true);
  });
});
