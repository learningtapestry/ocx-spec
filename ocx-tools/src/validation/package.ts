import { readFile } from "node:fs/promises";
import { BlobReader, TextWriter, ZipReader } from "@zip.js/zip.js";
import { satisfies } from "semver";
import type { Manifest } from "../manifest.js";
import validateOcx from "./ajv.js";
import validateManifest from "./manifest-ajv.js";

export const SUPPORTED_FORMAT_RANGE = "^1.0.0";

export interface ValidationError {
  type: "manifest" | "file" | "schema" | "version";
  path?: string;
  message: string;
  details?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
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

export async function validatePackage(
  zipPath: string,
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

  // Check all referenced files exist and validate OCX files
  for (const entry of manifest.contents) {
    const getFile = files.get(entry.path);

    if (!getFile) {
      errors.push({
        type: "file",
        path: entry.path,
        message: `Referenced file not found: ${entry.path}`,
      });
      continue;
    }

    // Validate OCX files against schema
    if (entry.path.endsWith(".ocx.json") || entry.path.endsWith(".json")) {
      try {
        const content = await getFile();
        const data = JSON.parse(content);

        if (!validateOcx(data)) {
          errors.push({
            type: "schema",
            path: entry.path,
            message: `Invalid OCX file: ${entry.path}`,
            details: validateOcx.errors,
          });
        }
      } catch (err) {
        errors.push({
          type: "schema",
          path: entry.path,
          message: `Failed to parse ${entry.path}: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
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
