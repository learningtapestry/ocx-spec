import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import manifestSchema from "../../src/manifest.schema.json" with {
  type: "json",
};
import validate from "../../src/validation/manifest-ajv";

const fixturesPath = path.join(__dirname, "..", "fixtures", "manifest");
const validManifest = JSON.parse(
  readFileSync(path.join(fixturesPath, "valid-manifest.json"), "utf-8"),
);
const invalidManifest = JSON.parse(
  readFileSync(path.join(fixturesPath, "invalid-manifest.json"), "utf-8"),
);

describe("validation/manifest-ajv", () => {
  it("exports a compiled Ajv validator for manifest.schema.json", () => {
    expect(typeof validate).toBe("function");
    expect(validate.schema).toBe(manifestSchema);
  });

  it("validates a valid manifest", () => {
    expect(validate(validManifest)).toBe(true);
  });

  it("rejects an invalid manifest", () => {
    expect(validate(invalidManifest)).toBe(false);
    expect(validate.errors).toBeDefined();
    expect(validate.errors?.length).toBeGreaterThan(0);
  });

  it("rejects manifest with invalid type", () => {
    const badType = {
      format: "ocx@1.0.0",
      contents: [{ path: "test.json", type: "InvalidType" }],
    };
    expect(validate(badType)).toBe(false);
  });

  it("rejects manifest with additional properties", () => {
    const extraProps = {
      format: "ocx@1.0.0",
      contents: [],
      unknownField: "not allowed",
    };
    expect(validate(extraProps)).toBe(false);
  });
});
