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
      title: "Quiz: Variables",
      content: "A quiz about variables and expressions",
    };
    expect(validate(valid)).toBe(true);
  });

  it("rejects LMS Activity missing title", () => {
    const invalid = {
      content: "A quiz about variables",
    };
    expect(validate(invalid)).toBe(false);
    expect(validate.errors).toHaveLength(1);
    const error = validate.errors?.[0];
    expect(error?.params).toHaveProperty("missingProperty", "title");
  });

  it("rejects LMS Activity missing content", () => {
    const invalid = {
      title: "Quiz: Variables",
    };
    expect(validate(invalid)).toBe(false);
    expect(validate.errors).toHaveLength(1);
    const error = validate.errors?.[0];
    expect(error?.params).toHaveProperty("missingProperty", "content");
  });

  it("rejects LMS Activity with extra properties", () => {
    const invalid = {
      title: "Quiz",
      content: "Content",
      extra: "not allowed",
    };
    expect(validate(invalid)).toBe(false);
    const error = validate.errors?.[0];
    expect(error?.keyword).toBe("additionalProperties");
  });

  it("rejects empty object", () => {
    expect(validate({})).toBe(false);
  });

  it("rejects non-string title", () => {
    const invalid = {
      title: 123,
      content: "A quiz",
    };
    expect(validate(invalid)).toBe(false);
  });

  it("rejects non-string content", () => {
    const invalid = {
      title: "Quiz",
      content: 456,
    };
    expect(validate(invalid)).toBe(false);
  });
});
