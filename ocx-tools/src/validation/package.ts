import { readFile } from "node:fs/promises";
import { BlobReader, TextWriter, ZipReader } from "@zip.js/zip.js";
import { satisfies } from "semver";
import type { Manifest } from "../manifest.js";
import validateOcx from "./ajv.js";
import validateManifest from "./manifest-ajv.js";

export const SUPPORTED_FORMAT_RANGE = "^1.0.0";

export interface ValidationError {
  type: "manifest" | "file" | "schema" | "version" | "reference" | "duplicate";
  path?: string;
  message: string;
  details?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface PackageValidationOptions {
  checkReferences?: boolean;
}

async function readZipEntries(
  zipPath: string,
): Promise<Map<string, () => Promise<string>>> {
  const fileData = await readFile(zipPath);
  const blob = new Blob([fileData]);
  const zipReader = new ZipReader(new BlobReader(blob));
  const entries = await zipReader.getEntries();

  const fileMap = new Map<string, () => Promise<string>>();
  for (const entry of entries) {
    if (!entry.directory && entry.getData) {
      const getData = entry.getData.bind(entry);
      fileMap.set(entry.filename, async () => {
        const writer = new TextWriter();
        await getData(writer);
        return writer.getData();
      });
    }
  }

  return fileMap;
}

function extractVersion(format: string): string | null {
  const match = format.match(/^ocx@(.+)$/);
  return match?.[1] ?? null;
}

interface OcxReference {
  id: string;
  type: string;
  property: string;
  sourcePath: string;
}

interface ParsedEntity {
  path: string;
  data: unknown;
  id?: string;
  type?: string;
}

/**
 * Parses all OCX files in the package.
 * Returns parsed entities and any parse errors encountered.
 */
async function parseOcxFiles(
  files: Map<string, () => Promise<string>>,
  manifest: Manifest,
): Promise<{ entities: ParsedEntity[]; errors: ValidationError[] }> {
  const entities: ParsedEntity[] = [];
  const errors: ValidationError[] = [];

  for (const entry of manifest.contents) {
    // Only process OCX JSON files
    if (!entry.path.endsWith(".ocx.json") && !entry.path.endsWith(".json")) {
      continue;
    }

    const getFile = files.get(entry.path);
    if (!getFile) {
      continue; // File not found - already handled by file validation
    }

    try {
      const content = await getFile();
      const data = JSON.parse(content);

      // Build entity object with optional properties
      const entity: ParsedEntity = { path: entry.path, data };

      // Extract @id and @type if they exist
      if (data && typeof data === "object") {
        if ("@id" in data && typeof data["@id"] === "string") {
          entity.id = data["@id"];
        }
        if ("@type" in data && typeof data["@type"] === "string") {
          entity.type = data["@type"];
        }
      }

      entities.push(entity);
    } catch (err) {
      errors.push({
        type: "schema",
        path: entry.path,
        message: `Failed to parse ${entry.path}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return { entities, errors };
}

/**
 * Extracts all @link references from an OCX entity.
 * Schema validation has already ensured @link structure is valid.
 */
function extractReferences(entity: unknown, filePath: string): OcxReference[] {
  const references: OcxReference[] = [];

  if (!entity || typeof entity !== "object") {
    return references;
  }

  // Properties that can contain @link references
  const linkProperties = [
    "hasPart",
    "hasEducationalAlignment",
    "usesRoutine",
    "uses",
    "hasDependency",
    "references",
    "mutuallyExclusiveWith",
    "hasChild",
  ];

  for (const propName of linkProperties) {
    const propValue = (entity as Record<string, unknown>)[propName];

    if (Array.isArray(propValue)) {
      for (const item of propValue) {
        if (
          item &&
          typeof item === "object" &&
          "link" in item &&
          typeof item.link === "object" &&
          item.link !== null
        ) {
          const link = item.link as { "@id"?: unknown; "@type"?: unknown };
          if (
            typeof link["@id"] === "string" &&
            typeof link["@type"] === "string"
          ) {
            references.push({
              id: link["@id"],
              type: link["@type"],
              property: propName,
              sourcePath: filePath,
            });
          }
        }
      }
    }
  }

  return references;
}

/**
 * Validates that all entity @id values in the package are unique.
 */
function validateUniqueIds(entities: ParsedEntity[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const idToFiles = new Map<string, string[]>();

  for (const entity of entities) {
    if (entity.id) {
      const filesWithId = idToFiles.get(entity.id) ?? [];
      filesWithId.push(entity.path);
      idToFiles.set(entity.id, filesWithId);
    }
  }

  // Check for duplicates
  for (const [id, files] of idToFiles.entries()) {
    if (files.length > 1) {
      errors.push({
        type: "duplicate",
        message: `Duplicate @id "${id}" found in multiple files: ${files.join(", ")}`,
        details: {
          duplicateId: id,
          files: files,
        },
      });
    }
  }

  return errors;
}

/**
 * Builds an index of all entity @id and @type values present in the package.
 */
function buildEntityIndex(entities: ParsedEntity[]): Map<string, string> {
  const entityIndex = new Map<string, string>();

  for (const entity of entities) {
    if (entity.id && entity.type) {
      entityIndex.set(entity.id, entity.type);
    }
  }

  return entityIndex;
}

/**
 * Validates that all @link references resolve to entities within the package.
 */
function validateReferences(entities: ParsedEntity[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // Build index of all entity IDs in the package
  const entityIndex = buildEntityIndex(entities);

  // Extract and validate all references
  for (const entity of entities) {
    const references = extractReferences(entity.data, entity.path);

    for (const ref of references) {
      const actualType = entityIndex.get(ref.id);

      if (!actualType) {
        // Reference @id does not exist in package
        errors.push({
          type: "reference",
          path: entity.path,
          message: `Unresolved reference to @id "${ref.id}" of type "${ref.type}" in property "${ref.property}"`,
          details: {
            referenceId: ref.id,
            referenceType: ref.type,
            property: ref.property,
          },
        });
      } else if (actualType !== ref.type) {
        // Reference @id exists but @type doesn't match
        errors.push({
          type: "reference",
          path: entity.path,
          message: `Type mismatch for @id "${ref.id}": expected "${ref.type}" but found "${actualType}" in property "${ref.property}"`,
          details: {
            referenceId: ref.id,
            expectedType: ref.type,
            actualType: actualType,
            property: ref.property,
          },
        });
      }
    }
  }

  return errors;
}

export async function validatePackage(
  zipPath: string,
  options?: PackageValidationOptions,
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  // Read zip file
  let files: Map<string, () => Promise<string>>;
  try {
    files = await readZipEntries(zipPath);
  } catch (err) {
    return {
      valid: false,
      errors: [
        {
          type: "file",
          message: `Failed to read zip file: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }

  // Check manifest exists
  const getManifest = files.get("manifest.json");
  if (!getManifest) {
    return {
      valid: false,
      errors: [
        {
          type: "manifest",
          path: "manifest.json",
          message: "manifest.json not found in package",
        },
      ],
    };
  }

  // Read and parse manifest
  let manifest: Manifest;
  try {
    const manifestContent = await getManifest();
    manifest = JSON.parse(manifestContent) as Manifest;
  } catch (err) {
    return {
      valid: false,
      errors: [
        {
          type: "manifest",
          path: "manifest.json",
          message: `Failed to parse manifest.json: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }

  // Validate manifest against schema
  if (!validateManifest(manifest)) {
    errors.push({
      type: "manifest",
      path: "manifest.json",
      message: "manifest.json is invalid",
      details: validateManifest.errors,
    });
  }

  // Check semver range
  const version = extractVersion(manifest.format);
  if (!version) {
    errors.push({
      type: "version",
      message: `Invalid format string: ${manifest.format}`,
    });
  } else if (!satisfies(version, SUPPORTED_FORMAT_RANGE)) {
    errors.push({
      type: "version",
      message: `Unsupported format version ${version}. Supported range: ${SUPPORTED_FORMAT_RANGE}`,
    });
  }

  // Check all referenced files exist
  for (const entry of manifest.contents) {
    const getFile = files.get(entry.path);

    if (!getFile) {
      errors.push({
        type: "file",
        path: entry.path,
        message: `Referenced file not found: ${entry.path}`,
      });
    }
  }

  // Parse all OCX files in a single pass
  const { entities, errors: parseErrors } = await parseOcxFiles(
    files,
    manifest,
  );
  errors.push(...parseErrors);

  // Validate OCX files against schema
  for (const entity of entities) {
    if (!validateOcx(entity.data)) {
      errors.push({
        type: "schema",
        path: entity.path,
        message: `Invalid OCX file: ${entity.path}`,
        details: validateOcx.errors,
      });
    }
  }

  // Validate unique @id values (always runs)
  const duplicateErrors = validateUniqueIds(entities);
  errors.push(...duplicateErrors);

  // Validate references if requested
  if (options?.checkReferences) {
    const refErrors = validateReferences(entities);
    errors.push(...refErrors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function validateOcxFile(
  filePath: string,
): Promise<ValidationResult> {
  try {
    const content = await readFile(filePath, "utf-8");
    const data = JSON.parse(content);

    if (!validateOcx(data)) {
      return {
        valid: false,
        errors: [
          {
            type: "schema",
            path: filePath,
            message: `Invalid OCX file: ${filePath}`,
            details: validateOcx.errors,
          },
        ],
      };
    }

    return { valid: true, errors: [] };
  } catch (err) {
    return {
      valid: false,
      errors: [
        {
          type: "file",
          path: filePath,
          message: `Failed to read or parse file: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }
}
