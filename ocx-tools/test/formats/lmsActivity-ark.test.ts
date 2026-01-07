import { type } from "arktype";
import { describe, expect, it } from "vitest";

import LmsActivity from "../../src/formats/lmsActivity-ark";

describe("formats/lmsActivity-ark", () => {
  it("exports an ArkType validator", () => {
    expect(LmsActivity).toBeDefined();
  });

  it("accepts valid LMS Activity", () => {
    const valid = {
      title: "Quiz: Variables",
      content: "A quiz about variables and expressions",
    };
    const result = LmsActivity(valid);
    expect(result).not.toBeInstanceOf(type.errors);
    expect(result).toEqual(valid);
  });

  it("rejects LMS Activity missing title", () => {
    const invalid = {
      content: "A quiz about variables",
    };
    const result = LmsActivity(invalid);
    expect(result).toBeInstanceOf(type.errors);
    if (result instanceof type.errors) {
      expect(result.summary).toContain("title");
    }
  });

  it("rejects LMS Activity missing content", () => {
    const invalid = {
      title: "Quiz: Variables",
    };
    const result = LmsActivity(invalid);
    expect(result).toBeInstanceOf(type.errors);
    if (result instanceof type.errors) {
      expect(result.summary).toContain("content");
    }
  });

  it("rejects empty object", () => {
    const result = LmsActivity({});
    expect(result).toBeInstanceOf(type.errors);
  });

  it("rejects non-string title", () => {
    const invalid = {
      title: 123,
      content: "A quiz",
    };
    const result = LmsActivity(invalid);
    expect(result).toBeInstanceOf(type.errors);
  });

  it("rejects non-string content", () => {
    const invalid = {
      title: "Quiz",
      content: 456,
    };
    const result = LmsActivity(invalid);
    expect(result).toBeInstanceOf(type.errors);
  });
});
