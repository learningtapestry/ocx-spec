import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { type } from "arktype";
import { describe, expect, it } from "vitest";

import ocx from "../../src/validation/ark";

const fixturesPath = path.join(
  __dirname,
  "..",
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
});
