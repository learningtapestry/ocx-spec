import { describe, expect, it } from "vitest";

import lmsActivitySchema from "../../src/formats/lmsActivity.schema.json" with {
  type: "json",
};
import validate from "../../src/formats/lmsActivity-ajv";

describe("formats/lmsActivity-ajv", () => {
  it("exports a compiled Ajv validator for lmsActivity.schema.json", () => {
    expect(typeof validate).toBe("function");
    expect(validate.schema).toBe(lmsActivitySchema);
  });

  it("accepts valid LMS Activity", () => {
    const valid = {
      name: "Quiz: Variables",
      description: "A quiz about variables and expressions",
    };
    expect(validate(valid)).toBe(true);
  });

  it("rejects LMS Activity missing name", () => {
    const invalid = {
      description: "A quiz about variables",
    };
    expect(validate(invalid)).toBe(false);
    expect(validate.errors).toHaveLength(1);
    expect(validate.errors?.[0].params).toHaveProperty(
      "missingProperty",
      "name",
    );
  });

  it("rejects LMS Activity missing description", () => {
    const invalid = {
      name: "Quiz: Variables",
    };
    expect(validate(invalid)).toBe(false);
    expect(validate.errors).toHaveLength(1);
    expect(validate.errors?.[0].params).toHaveProperty(
      "missingProperty",
      "description",
    );
  });

  it("rejects LMS Activity with extra properties", () => {
    const invalid = {
      name: "Quiz",
      description: "Description",
      extra: "not allowed",
    };
    expect(validate(invalid)).toBe(false);
    expect(validate.errors?.[0].keyword).toBe("additionalProperties");
  });

  it("rejects empty object", () => {
    expect(validate({})).toBe(false);
  });

  it("rejects non-string name", () => {
    const invalid = {
      name: 123,
      description: "A quiz",
    };
    expect(validate(invalid)).toBe(false);
  });

  it("rejects non-string description", () => {
    const invalid = {
      name: "Quiz",
      description: 456,
    };
    expect(validate(invalid)).toBe(false);
  });
});
