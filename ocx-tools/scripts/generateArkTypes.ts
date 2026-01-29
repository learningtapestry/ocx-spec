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

type Extensions = {
  entities?: Entity[];
  entityExtensions?: Record<string, Record<string, PropertyDetails>>;
};

type ResolvedArkType =
  | { kind: "primitive"; expression: string }
  | { kind: "enum"; name: string }
  | { kind: "entity"; name: string }
  | { kind: "unknown"; expression: string };

const readJson = <T>(filePath: string): T =>
  JSON.parse(fs.readFileSync(filePath, "utf8")) as T;

const [entitiesPathArg, valueStandardsPathArg, outputFileArg] =
  process.argv.slice(2);

if (!entitiesPathArg || !valueStandardsPathArg || !outputFileArg) {
  console.error(
    "Usage: generateArkTypes.ts <entities.json> <value_standards.json> <output-directory>",
  );
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entitiesPath = path.resolve(__dirname, "..", entitiesPathArg);
const valueStandardsPath = path.resolve(__dirname, "..", valueStandardsPathArg);
const extensionsPath = path.resolve(
  __dirname,
  "..",
  "ontology/extensions.json",
);

type DurationDef = {
  name: string;
  description: string;
  format: Array<{
    unit: string;
    format: string;
    example: string;
    meaning: string;
  }>;
};

const durationPath = path.resolve(__dirname, "..", "ontology/duration.json");

const baseEntities = readJson<Entity[]>(entitiesPath);
const valueStandards = readJson<ValueStandard[]>(valueStandardsPath);
const durationDef = fs.existsSync(durationPath)
  ? readJson<DurationDef>(durationPath)
  : undefined;
const extensions = fs.existsSync(extensionsPath)
  ? readJson<Extensions>(extensionsPath)
  : { entities: [], entityExtensions: {} };

// Merge extensions into entities
const entities = [...baseEntities, ...(extensions.entities ?? [])];

// Apply entity extensions (additional properties to existing entities)
if (extensions.entityExtensions) {
  for (const [entityName, props] of Object.entries(
    extensions.entityExtensions,
  )) {
    const entity = entities.find((e) => e.entity === entityName);
    if (entity) {
      entity.properties = { ...entity.properties, ...props };
    }
  }
}

const enumMap = valueStandards.reduce<Record<string, string[]>>(
  (acc, entry) => {
    acc[entry.name] = entry.values.map((v) => v.value);
    return acc;
  },
  {},
);

const primitiveArkMap: Record<string, string> = {
  String: "string",
  Boolean: "boolean",
  Integer: "number.integer",
  Datetime: "string.date.iso",
  ...(durationDef ? { [durationDef.name]: durationDef.name } : {}),
};

const enumNames = Object.keys(enumMap);
const entityNames = entities.map((entry) => entry.entity);
const unknownTypeWarnings = new Set<string>();

const wrapLiteral = (value: string) => `'${value}'`;
const isArray = (cardinality: string) => cardinality.includes("..n");
const isRequired = (cardinality: string) =>
  cardinality === "1" || cardinality === "1..n";
const normalizeTypes = (type: string | string[]) =>
  Array.isArray(type) ? type : [type];
const isPrimitiveType = (type: string): boolean => type in primitiveArkMap;

const resolveBaseType = (
  type: string,
  currentEntity: string,
): ResolvedArkType => {
  if (isPrimitiveType(type)) {
    return { kind: "primitive", expression: primitiveArkMap[type] as string };
  }
  if (enumNames.includes(type)) {
    return { kind: "enum", name: type };
  }
  if (entityNames.includes(type)) {
    return { kind: "entity", name: type };
  }
  if (!unknownTypeWarnings.has(type)) {
    console.warn(
      `Unknown type "${type}" in ${currentEntity}, defaulting to string`,
    );
    unknownTypeWarnings.add(type);
  }
  return { kind: "unknown", expression: primitiveArkMap.String as string };
};

const buildLinkExpression = (allowedEntities: string[]) => {
  const allowed = allowedEntities.map(wrapLiteral);
  const allowedUnion =
    allowed.length === 1 ? allowed[0] : `(${allowed.join(" | ")})`;
  return `OcxLink<${allowedUnion}>`;
};

const buildPropertyExpression = (
  details: PropertyDetails,
  currentEntity: string,
) => {
  const normalizedTypes = normalizeTypes(details.type);
  const resolvedTypes = normalizedTypes.map((entry) =>
    resolveBaseType(entry, currentEntity),
  );

  const expressions: string[] = [];
  const relationshipTargets = new Set<string>();

  resolvedTypes.forEach((resolved) => {
    switch (resolved.kind) {
      case "primitive": {
        expressions.push(resolved.expression);
        break;
      }
      case "enum": {
        expressions.push(resolved.name);
        break;
      }
      case "entity": {
        relationshipTargets.add(resolved.name);
        break;
      }
      case "unknown": {
        expressions.push(resolved.expression);
        break;
      }
    }
  });

  if (relationshipTargets.size > 0) {
    const allowed = Array.from(relationshipTargets);
    expressions.push(...allowed);
    expressions.push(buildLinkExpression(allowed));
  }

  if (expressions.length === 0) {
    expressions.push(primitiveArkMap.String as string);
  }

  const base =
    expressions.length === 1 ? expressions[0] : `(${expressions.join(" | ")})`;
  const propertyIsArray = isArray(details.cardinality);
  const propertyRequired = isRequired(details.cardinality);
  const expression = propertyIsArray
    ? `${base}[]${propertyRequired ? " > 0" : ""}`
    : base;

  return { expression, required: propertyRequired };
};

const buildEntityDefinition = (entity: Entity) => {
  const lines: string[] = [];
  lines.push(`  ${entity.entity}: {`);
  lines.push(`    "@id": "string",`);
  lines.push(`    "@type": ${JSON.stringify(wrapLiteral(entity.entity))},`);

  Object.entries(entity.properties ?? {}).forEach(([name, details]) => {
    const { expression, required } = buildPropertyExpression(
      details,
      entity.entity,
    );
    const key = required ? name : `${name}?`;
    lines.push(`    ${JSON.stringify(key)}: ${JSON.stringify(expression)},`);
  });

  lines.push("  },", "");
  return lines;
};

const buildArkFileContent = (entityList: Entity[]) => {
  const lines: string[] = [];
  lines.push(
    "// Auto-generated by scripts/generateArkTypes.ts. Do not edit manually.",
  );
  lines.push('import { scope, type } from "arktype";', "");

  if (durationDef) {
    lines.push(
      `const ${durationDef.name} = type(/^P(?!$)(\\d+Y)?(\\d+M)?(\\d+W)?(\\d+D)?(T(?!$)(\\d+H)?(\\d+M)?(\\d+(\\.\\d+)?S)?)?$/);`,
      "",
    );
  }

  lines.push("const enums = {");
  valueStandards.forEach((entry) => {
    const values = (enumMap[entry.name] ?? [])
      .map((value) => JSON.stringify(value))
      .join(", ");
    lines.push(`  ${entry.name}: type.enumerated(${values}),`, "");
  });
  lines.push("} as const;", "");

  lines.push(
    "const definitions = {",
    "  ...enums,",
    ...(durationDef ? ["", `  ${durationDef.name},`] : []),
    "",
    `  "OcxLink<t>": {`,
    `    link: {`,
    `      "@id": "string",`,
    `      "@type": "t",`,
    `    },`,
    "  },",
    "",
  );

  entityList.forEach((entity) => {
    lines.push(...buildEntityDefinition(entity));
  });

  lines.push("  OcxEntity: `");

  for (let i = 0; i < entityNames.length; i++) {
    const entityName = entityNames[i];
    const suffix = i === entityNames.length - 1 ? "" : " |";
    lines.push(`    ${entityName}${suffix}`);
  }

  lines.push("  `", "} as const;", "");

  lines.push("export const ocx = scope(definitions).export();", "");
  lines.push("export default ocx;", "");

  return `${lines.join("\n").trimEnd()}\n`;
};

const generate = () => {
  const content = buildArkFileContent(entities);
  fs.writeFileSync(outputFileArg, content);
  console.log(`ArkType definitions written to ${outputFileArg}`);
};

generate();
