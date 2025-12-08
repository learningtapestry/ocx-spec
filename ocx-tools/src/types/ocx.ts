// AUTO-GENERATED FILE. Do not edit directly; run generateSchemas instead.
import { scope } from "arktype";
import { entities, entityRelationships } from "./ontology";

const refable = (expression: string) => {
  const arrayRequired = expression.endsWith("[] > 0");
  if (arrayRequired) {
    const inner = expression.slice(0, -5).trim();
    return `refable<${inner}>[] > 0`;
  }
  const arrayMatch = expression.endsWith("[]");
  if (arrayMatch) {
    const inner = expression.slice(0, -2).trim();
    return `refable<${inner}>[]`;
  }
  return `refable<${expression}>`;
};

const ocxify = <Name extends keyof typeof entities>(
  name: Name,
  relationships: Record<string, string>,
) =>
  ({
    "...": name,
    "@type": `'${name}'`,
    ...Object.fromEntries(
      Object.entries(relationships).map(([key, value]) => [
        key,
        refable(value),
      ]),
    ),
  }) as const;

const ocxEntities = {
  ...entities,

  OcxRef: { $ref: "string" },

  "refable<target>": "target | OcxRef",

  OcxEntity:
    "OcxCourse | OcxLessonGrouping | OcxLesson | OcxActivity | OcxAssessment | OcxMaterial | OcxClassroomMaterial | OcxGlossaryTerm | OcxInstructionalRoutine | OcxStandardsFramework | OcxStandardsFrameworkItem",

  OcxCourse: ocxify("Course", entityRelationships.Course),

  OcxLessonGrouping: ocxify(
    "LessonGrouping",
    entityRelationships.LessonGrouping,
  ),

  OcxLesson: ocxify("Lesson", entityRelationships.Lesson),

  OcxActivity: ocxify("Activity", entityRelationships.Activity),

  OcxAssessment: ocxify("Assessment", entityRelationships.Assessment),

  OcxMaterial: ocxify("Material", entityRelationships.Material),

  OcxClassroomMaterial: ocxify(
    "ClassroomMaterial",
    entityRelationships.ClassroomMaterial,
  ),

  OcxGlossaryTerm: ocxify("GlossaryTerm", entityRelationships.GlossaryTerm),

  OcxInstructionalRoutine: ocxify(
    "InstructionalRoutine",
    entityRelationships.InstructionalRoutine,
  ),

  OcxStandardsFramework: ocxify(
    "StandardsFramework",
    entityRelationships.StandardsFramework,
  ),

  OcxStandardsFrameworkItem: ocxify(
    "StandardsFrameworkItem",
    entityRelationships.StandardsFrameworkItem,
  ),
} as const;

const $module = scope(ocxEntities).export(
  "OcxRef",
  "OcxEntity",
  "OcxCourse",
  "OcxLessonGrouping",
  "OcxLesson",
  "OcxActivity",
  "OcxAssessment",
  "OcxMaterial",
  "OcxClassroomMaterial",
  "OcxGlossaryTerm",
  "OcxInstructionalRoutine",
  "OcxStandardsFramework",
  "OcxStandardsFrameworkItem",
);

export const OcxRef = $module.OcxRef;
export const OcxEntity = $module.OcxEntity;
export const OcxCourse = $module.OcxCourse;
export const OcxLessonGrouping = $module.OcxLessonGrouping;
export const OcxLesson = $module.OcxLesson;
export const OcxActivity = $module.OcxActivity;
export const OcxAssessment = $module.OcxAssessment;
export const OcxMaterial = $module.OcxMaterial;
export const OcxClassroomMaterial = $module.OcxClassroomMaterial;
export const OcxGlossaryTerm = $module.OcxGlossaryTerm;
export const OcxInstructionalRoutine = $module.OcxInstructionalRoutine;
export const OcxStandardsFramework = $module.OcxStandardsFramework;
export const OcxStandardsFrameworkItem = $module.OcxStandardsFrameworkItem;
