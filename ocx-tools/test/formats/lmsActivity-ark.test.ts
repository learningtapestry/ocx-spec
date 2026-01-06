import { type } from "arktype";
import { describe, expect, it } from "vitest";

import LmsActivity from "../../src/formats/lmsActivity-ark";

describe("formats/lmsActivity-ark", () => {
  it("exports an ArkType validator", () => {
    expect(LmsActivity).toBeDefined();
  });

  it("accepts valid LMS Activity", () => {
    const valid = {
      name: "Quiz: Variables",
      description: "A quiz about variables and expressions",
    };
    const result = LmsActivity(valid);
    expect(result).not.toBeInstanceOf(type.errors);
    expect(result).toEqual(valid);
  });

  it("rejects LMS Activity missing name", () => {
    const invalid = {
      description: "A quiz about variables",
    };
    const result = LmsActivity(invalid);
    expect(result).toBeInstanceOf(type.errors);
    if (result instanceof type.errors) {
      expect(result.summary).toContain("name");
    }
  });

  it("rejects LMS Activity missing description", () => {
    const invalid = {
      name: "Quiz: Variables",
    };
    const result = LmsActivity(invalid);
    expect(result).toBeInstanceOf(type.errors);
    if (result instanceof type.errors) {
      expect(result.summary).toContain("description");
    }
  });

  it("rejects empty object", () => {
    const result = LmsActivity({});
    expect(result).toBeInstanceOf(type.errors);
  });

  it("rejects non-string name", () => {
    const invalid = {
      name: 123,
      description: "A quiz",
    };
    const result = LmsActivity(invalid);
    expect(result).toBeInstanceOf(type.errors);
  });

  it("rejects non-string description", () => {
    const invalid = {
      name: "Quiz",
      description: 456,
    };
    const result = LmsActivity(invalid);
    expect(result).toBeInstanceOf(type.errors);
  });
});
