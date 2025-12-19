import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import ocxSchema from "../../src/ocx.schema.json" with { type: "json" };
import validate from "../../src/validation/ajv";

const fixturesPath = path.join(
  __dirname,
  "..",
  "fixtures",
  "ocx",
  "sample-course",
);
const courseFixture = JSON.parse(
  readFileSync(path.join(fixturesPath, "course.json"), "utf-8"),
);

describe("validation/ajv", () => {
  it("exports a compiled Ajv validator for ocx.schema.json", () => {
    expect(typeof validate).toBe("function");
    expect(validate.schema).toBe(ocxSchema);

    expect(validate(courseFixture)).toBe(true);

    const invalidCourse = { ...courseFixture, audience: [] };
    expect(validate(invalidCourse)).toBe(false);
  });
});
