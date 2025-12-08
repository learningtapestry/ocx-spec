import { type } from "arktype";
import { expect, test } from "vitest";
import { OcxCourse, OcxLesson, type OcxRef } from "../src/types/ocx";
import { Course, entities as ontologyEntities } from "../src/types/ontology";

const expectValid = (schema: (value: unknown) => unknown, value: unknown) => {
  const result = schema(value);
  expect(result).not.toBeInstanceOf(type.errors);
  return result;
};

const expectInvalid = (schema: (value: unknown) => unknown, value: unknown) => {
  const result = schema(value);
  expect(result).toBeInstanceOf(type.errors);
  return result;
};

const baseCourse = {
  audience: ["Teacher"],
  author: "Author",
  identifier: "course-1",
  license: "MIT",
  providerDateCreated: "2024-01-01",
  providerDateModified: "2024-01-02",
};

const ocxValidCourse = {
  ...baseCourse,
  "@type": "Course" as const,
  hasPart: [{ $ref: "lesson-1" } satisfies typeof OcxRef.infer],
};

const ocxLessonMissingType = {
  audience: ["Teacher"],
  author: "Author",
  identifier: "lesson-1",
  license: "MIT",
  providerDateCreated: "2024-01-01",
  providerDateModified: "2024-01-02",
  hasPart: [{ $ref: "activity-1" }],
};

test("ontology Course validation", () => {
  expectValid(Course, baseCourse);
  expectInvalid(Course, { ...baseCourse, hasPart: [{ $ref: "lesson-1" }] });
  expect(Object.keys(ontologyEntities)).toContain("Course");
});

test("OCX Course validation", () => {
  expectValid(OcxCourse, ocxValidCourse);
  expectInvalid(OcxCourse, { ...ocxValidCourse, "@type": "Lesson" });
  expectInvalid(OcxCourse, { ...ocxValidCourse, hasPart: ["not-a-ref"] });
});

test("OCX Lesson validation", () => {
  expectInvalid(OcxLesson, ocxLessonMissingType);
});
