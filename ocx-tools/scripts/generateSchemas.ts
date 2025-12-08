/** biome-ignore-all lint/suspicious/noTemplateCurlyInString: we're generating code here. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type PropertyDetails = {
  type: string | string[];
  cardinality: string;
  [key: string]: unknown;
};

type Entity = {
  entity: string;
  properties?: Record<string, PropertyDetails>;
  [key: string]: unknown;
};

type ValueStandard = {
  name: string;
  values: Array<{ value: string }>;
  [key: string]: unknown;
};

type TypeExpressionMeta = {
  expression: string;
  optional: boolean;
  baseTypes: string[];
  isArray: boolean;
  requiredArray: boolean;
};

type RelationOverride = {
  name: string;
  key: string;
  optional: boolean;
  arkExpression: string;
  tsExpression: string;
  originalExpression: string;
};

type EntityBuild = {
  entity: string;
  baseLines: string[];
  relationOverrides: RelationOverride[];
};

type EnumMap = Record<string, string[]>;

const readJson = <T>(filePath: string): T =>
  JSON.parse(fs.readFileSync(filePath, "utf8")) as T;

const [entitiesPathArg, valueStandardsPathArg, outDirArg] =
  process.argv.slice(2);

if (!entitiesPathArg || !valueStandardsPathArg || !outDirArg) {
  console.error(
    "Usage: generateSchemas.ts <entities.json> <value_standards.json> <output-directory>",
  );
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const entitiesPath = path.resolve(__dirname, "..", entitiesPathArg);
const valueStandardsPath = path.resolve(__dirname, "..", valueStandardsPathArg);
const outDir = path.resolve(__dirname, "..", outDirArg);
const ontologyFile = path.join(outDir, "ontology.ts");
const ocxFile = path.join(outDir, "ocx.ts");

const entities = readJson<Entity[]>(entitiesPath);
const valueStandards = readJson<ValueStandard[]>(valueStandardsPath);

fs.mkdirSync(outDir, { recursive: true });

const primitiveMap = {
  String: "string",
  Boolean: "boolean",
  Integer: "number.integer",
  Datetime: "string.date.iso",
} as const satisfies Record<string, string>;

const isPrimitive = (type: string): type is keyof typeof primitiveMap =>
  type in primitiveMap;

const enums = valueStandards.reduce<EnumMap>((acc, entry) => {
  acc[entry.name] = entry.values.map((v) => v.value);
  return acc;
}, {});

const enumNames = Object.keys(enums);
const entityNames = entities.map((entry) => entry.entity);
const unknownTypeWarnings = new Set<string>();

const isArray = (cardinality: string) => cardinality.includes("..n");
const isRequired = (cardinality: string) =>
  cardinality === "1" || cardinality === "1..n";
const normalizeTypes = (type: string | string[]) =>
  Array.isArray(type) ? type : [type];

const resolveBaseType = (type: string, currentEntity: string): string => {
  if (isPrimitive(type)) {
    return primitiveMap[type];
  }
  if (enumNames.includes(type)) {
    return type;
  }
  if (entityNames.includes(type)) {
    return type;
  }
  if (!unknownTypeWarnings.has(type)) {
    console.warn(
      `Unknown type "${type}" in ${currentEntity}, defaulting to string`,
    );
    unknownTypeWarnings.add(type);
  }
  return primitiveMap.String;
};

const buildTypeExpression = (
  type: string | string[],
  details: PropertyDetails,
  currentEntity: string,
): TypeExpressionMeta => {
  const normalized = normalizeTypes(type);
  const resolved = normalized.map((entry) =>
    resolveBaseType(entry, currentEntity),
  );
  const safeResolved = (resolved.length ? resolved : [primitiveMap.String]) as [
    string,
    ...string[],
  ];

  const isUnion = safeResolved.length > 1;
  const baseExpr = isUnion ? `(${safeResolved.join(" | ")})` : safeResolved[0];
  const expression = baseExpr;

  const cardinalityIsArray = isArray(details.cardinality);
  const required = isRequired(details.cardinality);

  if (cardinalityIsArray) {
    if (required) {
      return {
        expression: `${expression}[] > 0`,
        optional: false,
        baseTypes: safeResolved,
        isArray: true,
        requiredArray: true,
      };
    }
    return {
      expression: `${expression}[]`,
      optional: true,
      baseTypes: safeResolved,
      isArray: true,
      requiredArray: false,
    };
  }

  return {
    expression,
    optional: !required,
    baseTypes: safeResolved,
    isArray: false,
    requiredArray: false,
  };
};

const buildRefableExpression = ({
  baseTypes,
  isArray: array,
  requiredArray,
}: Pick<TypeExpressionMeta, "baseTypes" | "isArray" | "requiredArray">) => {
  const union =
    baseTypes.length > 1 ? `(${baseTypes.join(" | ")})` : baseTypes[0];
  const refable = `refable<${union}>`;
  const tsRefable = `Refable<${union}>`;
  if (!array) {
    return {
      arkExpression: refable,
      tsExpression: tsRefable,
    };
  }
  return {
    arkExpression: `${refable}[]${requiredArray ? " > 0" : ""}`,
    tsExpression: `${tsRefable}[]`,
  };
};

function buildEntityDefinition(entity: Entity): EntityBuild {
  const props: Record<string, PropertyDetails> = entity.properties ?? {};
  const baseLines: string[] = [`\t${entity.entity}: {`];
  const baseProps: string[] = [];
  const relationOverrides: RelationOverride[] = [];

  for (const [name, details] of Object.entries(props)) {
    const meta = buildTypeExpression(details.type, details, entity.entity);
    const key = meta.optional ? `${name}?` : name;
    const relatesToEntity = meta.baseTypes.some((base) =>
      entityNames.includes(base),
    );

    if (relatesToEntity) {
      const { arkExpression, tsExpression } = buildRefableExpression(meta);
      relationOverrides.push({
        name,
        key,
        optional: meta.optional,
        arkExpression,
        tsExpression,
        originalExpression: meta.expression,
      });
    } else {
      baseProps.push(`\t\t"${key}": ${JSON.stringify(meta.expression)},`);
    }
  }

  baseLines.push(...baseProps);
  baseLines.push("\t},");

  return { entity: entity.entity, baseLines, relationOverrides };
}

function buildOntologyContent(entityBuilds: EntityBuild[]) {
  const lines = [
    "// AUTO-GENERATED FILE. Do not edit directly; run generateSchemas instead.",
    'import { scope, type } from "arktype";',
    "",
  ];

  lines.push("export const enums = {");
  enumNames.forEach((name) => {
    const values = (enums[name] ?? [])
      .map((value) => JSON.stringify(value))
      .join(", ");
    lines.push(`\t${name}: type.enumerated(${values}),`);
  });
  lines.push("} as const;", "");

  lines.push("const entityBase = {");
  entityBuilds.forEach((build) => {
    lines.push(...build.baseLines);
  });
  lines.push("} as const;", "");

  lines.push("export const entityRelationships = {");
  entityBuilds.forEach((build) => {
    lines.push(`\t${build.entity}: {`);
    build.relationOverrides.forEach((relation) => {
      lines.push(
        `\t\t"${relation.key}": ${JSON.stringify(relation.originalExpression)},`,
      );
    });
    lines.push("\t},");
  });
  lines.push("} as const;", "");

  lines.push("export const entities = {", "\t...enums,");
  entityBuilds.forEach((build) => {
    lines.push(
      `\t${build.entity}: { ...entityBase.${build.entity}, ...entityRelationships.${build.entity} },`,
    );
  });
  lines.push("} as const;", "");
  lines.push("export const $module = scope(entities).export();", "");

  enumNames.forEach((name) => {
    lines.push(`export const ${name} = $module.${name};`);
  });

  entityBuilds.forEach((build) => {
    lines.push(`export const ${build.entity} = $module.${build.entity};`);
  });

  return `${lines.join("\n").trimEnd()}\n`;
}

function buildOcxContent(entityBuilds: EntityBuild[]) {
  const ocxAliases = [
    "OcxRef",
    "OcxEntity",
    ...entityBuilds.map((b) => `Ocx${b.entity}`),
  ];
  const ocxEntityUnion = entityBuilds.map((b) => `Ocx${b.entity}`).join(" | ");
  const lines = [
    "// AUTO-GENERATED FILE. Do not edit directly; run generateSchemas instead.",
    'import { scope } from "arktype";',
    'import { entities, entityRelationships } from "./ontology";',
    "",
    "const refable = (expression: string) => {",
    '  const arrayRequired = expression.endsWith("[] > 0");',
    "  if (arrayRequired) {",
    "    const inner = expression.slice(0, -5).trim();",
    "    return `refable<${inner}>[] > 0`;",
    "  }",
    '  const arrayMatch = expression.endsWith("[]");',
    "  if (arrayMatch) {",
    "    const inner = expression.slice(0, -2).trim();",
    "    return `refable<${inner}>[]`;",
    "  }",
    "  return `refable<${expression}>`;",
    "};",
    "",
    "const ocxify = <Name extends keyof typeof entities>(",
    "  name: Name,",
    "  relationships: Record<string, string>",
    ") => ({",
    '  "...": name,',
    "  \"@type\": `'${name}'`,",
    "  ...Object.fromEntries(",
    "    Object.entries(relationships).map(([key, value]) => [key, refable(value)])",
    "  ),",
    "}) as const;",
    "",
    "const ocxEntities = {",
    " ...entities,",
    "",
    '  OcxRef: { "$ref": "string" },',
    "",
    '  "refable<target>": "target | OcxRef",',
    "",
    `  OcxEntity: "${ocxEntityUnion}",`,
    "",
  ];

  entityBuilds.forEach((build) => {
    lines.push(
      `  Ocx${build.entity}: ocxify("${build.entity}", entityRelationships.${build.entity}),`,
      "",
    );
  });

  lines.push("} as const;", "");

  const quotedAliasesList = ocxAliases
    .map((alias) => JSON.stringify(alias))
    .join(", ");
  lines.push(
    `const $module = scope(ocxEntities).export(${quotedAliasesList});`,
    "",
  );

  lines.push("export const OcxRef = $module.OcxRef;");
  lines.push("export const OcxEntity = $module.OcxEntity;");

  entityBuilds.forEach((build) => {
    lines.push(`export const Ocx${build.entity} = $module.Ocx${build.entity};`);
  });

  return `${lines.join("\n").trimEnd()}\n`;
}

function generate() {
  const entityBuilds: EntityBuild[] = entities.map((entity) => ({
    ...buildEntityDefinition(entity),
  }));

  const ontologyContent = buildOntologyContent(entityBuilds);
  const ocxContent = buildOcxContent(entityBuilds);

  fs.writeFileSync(ontologyFile, ontologyContent);
  fs.writeFileSync(ocxFile, ocxContent);
}

generate();
