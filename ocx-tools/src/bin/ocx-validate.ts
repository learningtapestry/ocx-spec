#!/usr/bin/env node

import {
  type ValidationResult,
  validateOcxFile,
  validatePackage,
} from "../validation/package.js";

interface CliOptions {
  json: boolean;
  checkReferences: boolean;
  validateContent: boolean;
  files: string[];
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    checkReferences: false,
    validateContent: false,
    files: [],
  };

  for (const arg of args) {
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--check-references") {
      options.checkReferences = true;
    } else if (arg === "--validate-content") {
      options.validateContent = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith("-")) {
      options.files.push(arg);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`ocx-validate - Validate OCX files and packages

Usage:
  ocx-validate [options] <file...>

Arguments:
  file    One or more .ocx.json or .ocx.zip files to validate

Options:
  --json               Output results as JSON
  --check-references   Validate @link references within packages (packages only)
  --validate-content   Validate Representation content files (packages only)
  --help               Show this help message

Examples:
  ocx-validate course.ocx.json
  ocx-validate lesson.ocx.json activity.ocx.json
  ocx-validate curriculum.ocx.zip
  ocx-validate --json course.ocx.json
  ocx-validate --check-references curriculum.ocx.zip
  ocx-validate --validate-content curriculum.ocx.zip
`);
}

function formatErrors(result: ValidationResult, filePath: string): string {
  const lines: string[] = [];
  lines.push(`\x1b[31m✗\x1b[0m ${filePath}`);
  for (const error of result.errors) {
    const location = error.path ? ` (${error.path})` : "";
    lines.push(`  - [${error.type}]${location}: ${error.message}`);

    // Show AJV error details for schema/manifest errors
    if (error.details && Array.isArray(error.details)) {
      for (const detail of error.details) {
        const path = detail.instancePath || "(root)";
        const keyword = detail.keyword ? `[${detail.keyword}]` : "";
        let extra = "";
        if (detail.params) {
          if (detail.params.additionalProperty) {
            extra = ` (property: ${detail.params.additionalProperty})`;
          } else if (detail.params.missingProperty) {
            extra = ` (missing: ${detail.params.missingProperty})`;
          } else if (detail.params.allowedValues) {
            extra = ` (allowed: ${detail.params.allowedValues.join(", ")})`;
          }
        }
        lines.push(`      ${path} ${keyword}: ${detail.message}${extra}`);
      }
    }
  }
  return lines.join("\n");
}

function formatSuccess(filePath: string): string {
  return `\x1b[32m✓\x1b[0m ${filePath}`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.files.length === 0) {
    console.error("Error: No files specified\n");
    printHelp();
    process.exit(1);
  }

  const results: { file: string; result: ValidationResult }[] = [];
  let hasErrors = false;

  for (const file of options.files) {
    let result: ValidationResult;

    if (file.endsWith(".ocx.zip")) {
      result = await validatePackage(file, {
        checkReferences: options.checkReferences,
        validateContent: options.validateContent,
      });
    } else if (file.endsWith(".ocx.json") || file.endsWith(".json")) {
      result = await validateOcxFile(file);
    } else {
      result = {
        valid: false,
        errors: [
          {
            type: "file",
            path: file,
            message: `Unknown file type. Expected .ocx.json or .ocx.zip`,
          },
        ],
      };
    }

    results.push({ file, result });
    if (!result.valid) {
      hasErrors = true;
    }
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const { file, result } of results) {
      if (result.valid) {
        console.log(formatSuccess(file));
      } else {
        console.log(formatErrors(result, file));
      }
    }

    const validCount = results.filter((r) => r.result.valid).length;
    const totalCount = results.length;
    console.log(`\n${validCount}/${totalCount} files valid`);
  }

  process.exit(hasErrors ? 1 : 0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
