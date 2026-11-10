import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

type PropertyDetails = {
  type: string | string[];
  cardinality: string;
  description?: string;
  linkProperties?: Record<string, LinkPropertyDetails>;
  [key: string]: unknown;
};

type LinkPropertyDetails = {
  type: string | string[];
  cardinality: string;
  description?: string;
};

type Entity = {
  entity: string;
  properties?: Record<string, PropertyDetails>;
  definition?: string;
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

type JsonSchema = Record<string, unknown>;

type ResolvedType =
  | { kind: "primitive"; schema: JsonSchema }
  | { kind: "enum"; name: string }
  | { kind: "entity"; name: string }
  | { kind: "unknown"; schema: JsonSchema };

const readJson = <T>(filePath: string): T =>
  JSON.parse(fs.readFileSync(filePath, "utf8")) as T;

const [entitiesPathArg, valueStandardsPathArg, outDirArg] =
  process.argv.slice(2);

if (!entitiesPathArg || !valueStandardsPathArg || !outDirArg) {
  console.error(
    "Usage: generateJsonSchema.ts <entities.json> <value_standards.json> <output-directory>",
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
const durationPath = path.resolve(__dirname, "..", "ontology/duration.json");
const outDir = path.resolve(__dirname, "..", outDirArg);
const schemaFile = path.join(outDir, "ocx.schema.json");
const typesFile = path.join(outDir, "ocx.d.ts");

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

const ISO_8601_DURATION_PATTERN =
  "^P(?!$)(\\d+Y)?(\\d+M)?(\\d+W)?(\\d+D)?(T(?!$)(\\d+H)?(\\d+M)?(\\d+(\\.\\d+)?S)?)?$";

const primitiveMap: Record<string, JsonSchema> = {
  String: { type: "string" },
  Boolean: { type: "boolean" },
  Integer: { type: "integer" },
  Datetime: { type: "string", format: "date-time" },
  ...(durationDef
    ? {
        [durationDef.name]: {
          type: "string",
          pattern: ISO_8601_DURATION_PATTERN,
          description: durationDef.description,
        },
      }
    : {}),
};
const tsPrimitiveMap: Record<string, string> = {
  String: "string",
  Boolean: "boolean",
  Integer: "number",
  Datetime: "string",
  ...(durationDef ? { [durationDef.name]: durationDef.name } : {}),
};

// Primitives that should be emitted as $ref definitions rather than inlined
const primitiveRefMap: Record<string, string> = {
  ...(durationDef ? { [durationDef.name]: durationDef.name } : {}),
};

const enumNames = Object.keys(enumMap);
const entityNames = entities.map((entry) => entry.entity);
const unknownTypeWarnings = new Set<string>();
const cloneSchema = (schema: JsonSchema): JsonSchema =>
  JSON.parse(JSON.stringify(schema));
const isPrimitiveType = (type: string): type is keyof typeof primitiveMap =>
  type in primitiveMap;
const getPrimitiveSchema = (type: keyof typeof primitiveMap): JsonSchema => {
  const schema = primitiveMap[type];
  if (!schema) {
    throw new Error(`Unknown primitive type: ${type}`);
  }
  return cloneSchema(schema);
};

const buildLinkRef = (
  allowedTypes: string[],
  linkProperties: Record<string, LinkPropertyDetails> | undefined,
  currentEntity: string,
): JsonSchema => {
  if (linkProperties && Object.keys(linkProperties).length > 0) {
    return buildLinkSchema(allowedTypes, linkProperties, currentEntity);
  }

  const typeConstraint =
    allowedTypes.length === 1
      ? { const: allowedTypes[0] }
      : { enum: allowedTypes };

  return {
    allOf: [
      { $ref: "#/definitions/OcxLink" },
      {
        properties: {
          link: {
            properties: {
              "@type": typeConstraint,
            },
          },
        },
      },
    ],
  };
};

const isArray = (cardinality: string) => cardinality.includes("..n");
const isRequired = (cardinality: string) =>
  cardinality === "1" || cardinality === "1..n";
const normalizeTypes = (type: string | string[]) =>
  Array.isArray(type) ? type : [type];
const isIdentifier = (value: string) => /^[A-Za-z_$][\w$]*$/.test(value);
const formatPropertyName = (name: string) =>
  isIdentifier(name) ? name : JSON.stringify(name);
const sanitizeDescription = (description: string) =>
  description.replace(/\r?\n\s*/g, " ").replace(/\*\//g, "*\\/");

const resolveBaseType = (type: string, currentEntity: string): ResolvedType => {
  if (isPrimitiveType(type)) {
    const refName = primitiveRefMap[type];
    if (refName) {
      return { kind: "enum", name: refName };
    }
    return { kind: "primitive", schema: getPrimitiveSchema(type) };
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
  return { kind: "unknown", schema: getPrimitiveSchema("String") };
};

const buildLinkPropertySchema = (
  details: LinkPropertyDetails,
  currentEntity: string,
): JsonSchema => {
  const schemas = normalizeTypes(details.type).map((entry) => {
    const resolved = resolveBaseType(entry, currentEntity);
    switch (resolved.kind) {
      case "primitive":
      case "unknown":
        return resolved.schema;
      case "enum":
        return { $ref: `#/definitions/${resolved.name}` };
      case "entity":
        throw new Error(
          `Link property on ${currentEntity} cannot target entity ${resolved.name}`,
        );
    }
    throw new Error(`Unsupported link property type on ${currentEntity}`);
  });

  const schema =
    schemas.length === 1 ? (schemas[0] as JsonSchema) : { anyOf: schemas };
  if (details.description) {
    schema.description = details.description;
  }
  return schema;
};

const buildLinkSchema = (
  allowedTypes: string[],
  linkProperties: Record<string, LinkPropertyDetails> = {},
  currentEntity = "OcxLink",
): JsonSchema => {
  const properties: Record<string, JsonSchema> = {
    link: {
      type: "object",
      properties: {
        "@id": { type: "string" },
        "@type":
          allowedTypes.length === 1
            ? { const: allowedTypes[0] }
            : { enum: allowedTypes },
      },
      required: ["@id", "@type"],
      additionalProperties: false,
    },
  };
  const required = ["link"];

  Object.entries(linkProperties).forEach(([name, details]) => {
    properties[name] = buildLinkPropertySchema(details, currentEntity);
    if (isRequired(details.cardinality)) {
      required.push(name);
    }
  });

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
};

const buildPropertySchema = (
  details: PropertyDetails,
  currentEntity: string,
) => {
  const normalizedTypes = normalizeTypes(details.type);
  const resolvedTypes = normalizedTypes.map((entry) =>
    resolveBaseType(entry, currentEntity),
  );

  const schemas: JsonSchema[] = [];
  const relationshipTargets = new Set<string>();

  resolvedTypes.forEach((resolved) => {
    if (resolved.kind === "primitive" || resolved.kind === "unknown") {
      schemas.push(resolved.schema);
      return;
    }
    if (resolved.kind === "enum") {
      schemas.push({ $ref: `#/definitions/${resolved.name}` });
      return;
    }
    if (resolved.kind === "entity") {
      relationshipTargets.add(resolved.name);
    }
  });

  if (relationshipTargets.size > 0) {
    const refs = Array.from(relationshipTargets).map((name) => ({
      $ref: `#/definitions/${name}`,
    }));
    const linkRef = buildLinkRef(
      Array.from(relationshipTargets),
      details.linkProperties,
      currentEntity,
    );
    const relationshipSchema =
      refs.length === 1
        ? { anyOf: [refs[0], linkRef] }
        : { anyOf: [...refs, linkRef] };
    schemas.push(relationshipSchema);
  }

  let baseSchema: JsonSchema;
  if (schemas.length === 0) {
    baseSchema = getPrimitiveSchema("String");
  } else if (schemas.length === 1) {
    const firstSchema = schemas[0];
    if (!firstSchema) {
      throw new Error("Unexpected missing schema for relationship");
    }
    baseSchema = firstSchema;
  } else {
    baseSchema = { anyOf: schemas };
  }

  const cardinalityIsArray = isArray(details.cardinality);
  const propertyRequired = isRequired(details.cardinality);

  const schema: JsonSchema = cardinalityIsArray
    ? {
        type: "array",
        items: baseSchema,
        ...(propertyRequired ? { minItems: 1 } : {}),
      }
    : baseSchema;

  if (details.description && typeof schema === "object" && schema !== null) {
    schema.description = details.description;
  }

  return { schema, required: propertyRequired };
};

const buildEntitySchema = (entity: Entity): JsonSchema => {
  const properties: Record<string, JsonSchema> = {
    "@id": { type: "string" },
    "@type": { const: entity.entity },
  };
  const required = ["@id", "@type"];

  Object.entries(entity.properties ?? {}).forEach(([name, details]) => {
    const { schema, required: propertyRequired } = buildPropertySchema(
      details,
      entity.entity,
    );
    properties[name] = schema;
    if (propertyRequired) {
      required.push(name);
    }
  });

  const entitySchema: JsonSchema = {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };

  if (entity.definition) {
    entitySchema.description = entity.definition;
  }

  return entitySchema;
};

const buildSchema = () => {
  const enumSchemas = Object.fromEntries(
    Object.entries(enumMap).map(([name, values]) => [
      name,
      { type: "string", enum: values },
    ]),
  );

  const primitiveRefSchemas = Object.fromEntries(
    Object.keys(primitiveRefMap).map((key) => [
      key,
      cloneSchema(primitiveMap[key] as JsonSchema),
    ]),
  );

  const entitySchemas = Object.fromEntries(
    entities.map((entity) => [entity.entity, buildEntitySchema(entity)]),
  );

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "ocx.schema.json",
    title: "OCX Entities",
    oneOf: entityNames.map((name) => ({ $ref: `#/definitions/${name}` })),
    definitions: {
      OcxLink: buildLinkSchema(entityNames),
      ...primitiveRefSchemas,
      ...enumSchemas,
      ...entitySchemas,
    },
  };
};

const buildPropertyType = (
  details: PropertyDetails,
  currentEntity: string,
): { type: string; required: boolean } => {
  const normalizedTypes = normalizeTypes(details.type);
  const resolvedTypes = normalizedTypes.map((entry) =>
    resolveBaseType(entry, currentEntity),
  );

  const propertyTypes: string[] = [];
  const relationshipTargets = new Set<string>();

  const addType = (type: string) => {
    if (!propertyTypes.includes(type)) {
      propertyTypes.push(type);
    }
  };

  resolvedTypes.forEach((resolved, index) => {
    const sourceType = normalizedTypes[index];
    switch (resolved.kind) {
      case "primitive": {
        const tsType =
          tsPrimitiveMap[sourceType as keyof typeof tsPrimitiveMap] ?? "string";
        addType(tsType);
        break;
      }
      case "enum": {
        const tsAlias = tsPrimitiveMap[resolved.name];
        addType(tsAlias ?? resolved.name);
        break;
      }
      case "entity": {
        relationshipTargets.add(resolved.name);
        break;
      }
      case "unknown": {
        addType("string");
        break;
      }
    }
  });

  if (relationshipTargets.size > 0) {
    const allowedEntities = Array.from(relationshipTargets);
    addType(allowedEntities.join(" | "));
    const linkType = `OcxLink<${allowedEntities.map((entry) => JSON.stringify(entry)).join(" | ")}>`;
    const linkProperties = Object.entries(details.linkProperties ?? {});
    if (linkProperties.length === 0) {
      addType(linkType);
    } else {
      const metadata = linkProperties
        .map(([name, property]) => {
          const types = normalizeTypes(property.type).map((entry) => {
            const resolved = resolveBaseType(entry, currentEntity);
            switch (resolved.kind) {
              case "primitive":
                return (
                  tsPrimitiveMap[entry as keyof typeof tsPrimitiveMap] ??
                  "string"
                );
              case "enum":
                return resolved.name;
              case "unknown":
                return "string";
              case "entity":
                throw new Error(
                  `Link property on ${currentEntity} cannot target entity ${resolved.name}`,
                );
            }
            throw new Error(
              `Unsupported link property type on ${currentEntity}`,
            );
          });
          const optional = isRequired(property.cardinality) ? "" : "?";
          return `${formatPropertyName(name)}${optional}: ${types.join(" | ")}`;
        })
        .join("; ");
      addType(`${linkType} & { ${metadata} }`);
    }
  }

  if (propertyTypes.length === 0) {
    addType("string");
  }

  const hasUnion = propertyTypes.length > 1;
  const unionType = propertyTypes.join(" | ");
  const baseType = hasUnion ? `(${unionType})` : unionType;
  const isArrayCardinality = isArray(details.cardinality);

  return {
    type: isArrayCardinality ? `${baseType}[]` : baseType,
    required: isRequired(details.cardinality),
  };
};

const buildTypeDefinitions = () => {
  const lines: string[] = [];

  lines.push(
    "// Auto-generated by scripts/generateSchema.ts. Do not edit manually.",
    "",
  );

  if (durationDef) {
    lines.push(
      'import type { regex } from "arkregex";',
      "",
      `/** ${sanitizeDescription(durationDef.description)} */`,
      `export type ${durationDef.name} = regex.infer<"${ISO_8601_DURATION_PATTERN}">;`,
      "",
    );
  }

  lines.push(
    `export type OcxEntityType = ${entityNames
      .map((entry) => JSON.stringify(entry))
      .join(" | ")};`,
    "",
  );
  lines.push(
    "export type OcxLink<T extends string = OcxEntityType> = {",
    "  link: {",
    '    "@id": string;',
    '    "@type": T;',
    "  };",
    "};",
    "",
  );

  Object.entries(enumMap).forEach(([name, values]) => {
    lines.push(
      `export type ${name} = ${values
        .map((entry) => JSON.stringify(entry))
        .join(" | ")};`,
      "",
    );
  });
  if (Object.keys(enumMap).length > 0) {
    lines.push("");
  }

  entities.forEach((entity) => {
    if (entity.definition) {
      lines.push(`/** ${sanitizeDescription(entity.definition)} */`);
    }
    lines.push(`export type ${entity.entity} = {`);
    lines.push('  "@id": string;');
    lines.push(`  "@type": ${JSON.stringify(entity.entity)};`);

    Object.entries(entity.properties ?? {}).forEach(([name, details]) => {
      const { type, required } = buildPropertyType(details, entity.entity);
      const formattedName = formatPropertyName(name);
      const doc = details.description
        ? `  /** ${sanitizeDescription(details.description)} */`
        : undefined;
      if (doc) {
        lines.push(doc);
      }
      lines.push(`  ${formattedName}${required ? "" : "?"}: ${type};`);
    });

    lines.push("};", "");
  });

  lines.push(`export type OcxEntity = ${entityNames.join(" | ")};`, "");

  return `${lines.join("\n").trimEnd()}\n`;
};

const generate = () => {
  const schema = buildSchema();
  const ajv = new Ajv({ allErrors: true, strict: false });

  if (!ajv.validateSchema(schema)) {
    console.error("Generated schema is invalid", ajv.errors);
    process.exit(1);
  }

  const typeDefinitions = buildTypeDefinitions();

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(schemaFile, `${JSON.stringify(schema, null, 2)}\n`);
  fs.writeFileSync(typesFile, typeDefinitions);
  console.log(`JSON schema written to ${schemaFile}`);
  console.log(`Type definitions written to ${typesFile}`);
};

generate();
