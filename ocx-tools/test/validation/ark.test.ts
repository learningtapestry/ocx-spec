import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { type } from "arktype";
import { describe, expect, it } from "vitest";

import ocx from "../../src/validation/ark";

const fixturesPath = path.join(
  __dirname,
  "..",
  "fixtures",
  "ocx",
  "sample-course",
);

const loadFixture = (file: string) =>
  JSON.parse(readFileSync(path.join(fixturesPath, file), "utf-8"));

type Ocx = typeof ocx;

function hasValidator(map: Ocx, key: string): key is keyof Ocx {
  return key in map;
}

describe("validation/ark", () => {
  const fixtureFiles = readdirSync(fixturesPath).filter((file) =>
    file.endsWith(".json"),
  );

  it("accepts the sample OCX fixtures", () => {
    const invalid = fixtureFiles.flatMap((file) => {
      const data = loadFixture(file);
      const typeName = data["@type"];
      if (typeof typeName !== "string") {
        return expect.fail(`${file} fixture missing @type"`);
      }

      if (!hasValidator(ocx, typeName)) {
        return expect.fail(`No validator exported for ${typeName}`);
      }

      const validator = ocx[typeName];

      const result = (validator as (value: unknown) => unknown)(data);
      return result instanceof type.errors
        ? [{ file, summary: result.summary }]
        : [];
    });

    expect(invalid).toEqual([]);
  });

  it("rejects invalid OCX payloads", () => {
    const course = loadFixture("course.json");

    const withoutId = { ...course };
    delete withoutId["@id"];

    const emptyAudience = { ...course, audience: [] };

    [ocx.Course(withoutId), ocx.Course(emptyAudience)].forEach((result) => {
      expect(result).toBeInstanceOf(type.errors);
    });
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
      const result = ocx.Activity({ ...baseActivity, timeRequired: duration });
      expect(result).not.toBeInstanceOf(type.errors);
    });

    it.each([
      ["45 minutes", "plain text"],
      ["P", "bare P with no components"],
      ["PT", "bare PT with no time components"],
      ["1H30M", "missing P prefix"],
      ["", "empty string"],
    ])("rejects invalid duration %s (%s)", (duration) => {
      const result = ocx.Activity({ ...baseActivity, timeRequired: duration });
      expect(result).toBeInstanceOf(type.errors);
    });
  });

  it("exports an OcxEntity union", () => {
    const course = loadFixture("course.json");
    expect(ocx.OcxEntity(course)).not.toBeInstanceOf(type.errors);
  });
});
