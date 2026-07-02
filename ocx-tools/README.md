# @learningtapestry/ocx-tools
@learningtapestry/ocx-tools packages the K-12 OCX JSON schema, TypeScript types, preconfigured validators, and CLI tooling for Node.js.

Requires Node 20.10+.

## Working with the type library

Static typing for OCX entities so your code gets proper shapes and autocompletion.

```bash
npm install @learningtapestry/ocx-tools
```

```ts
import type { Course } from "@learningtapestry/ocx-tools/ocx";

function CourseComponent({ course }: { course: Course }) {
  // ...
}
```

Format-specific type definitions are available as type-only subpath exports.

```ts
import type { LmsActivity } from "@learningtapestry/ocx-tools/formats/lmsActivity";
```

## Working with ArkType

Fast runtime validation with [ArkType](https://arktype.io/).


The dependency on ArkType is optional; only install it if you need it.

```bash
npm install @learningtapestry/ocx-tools arktype
```

```ts
import ocx from "@learningtapestry/ocx-tools/validation/ark";

// `ocx` is an ArkType module containing all the OCX entities, including a generic
// `OcxEntity` that should match any valid object by `@type`.

// ... get supposed `ocxData` from somewhere ...
const out = ocx.OcxEntity(ocxData);

if (out.problems) {
	console.error(out.summary);
} else {
  // `out` (`ocxData`) is a valid OCX object; you can cast it to the proper type
}

// You can also do this:
import { type } from "arktype";

if (out instanceof type.errors) {
	// Hover summary to see validation errors
	console.error(out.summary)
}
```

## Working with JSON Schema

A precompiled [AJV](https://ajv.js.org/) validator is available if you'd like to work with JSON Schema-based validation at runtime.

AJV is included as a package dependency because the built-in validators and package validation APIs use it.

```bash
npm install @learningtapestry/ocx-tools
```

```ts
import validate from "@learningtapestry/ocx-tools/validation/ajv";

// ... get `ocxData` from somewhere ...

if (!validate(ocxData)) {
  console.error(validate.errors);
}
```

The JSON schema is also directly available [here](src/ocx.schema.json). You can use it as follows:

```ts
import Ajv from "ajv";
import ocxSchema from "@learningtapestry/ocx-tools/ocx.schema.json" with { type: "json" };

const ajv = new Ajv({ strict: false, allErrors: true });

ajv.addFormat("date-time", {
  type: "string",
  validate: (value: string) => !Number.isNaN(Date.parse(value)),
});

export const validate = ajv.compile(ocxSchema);
```

## CLI tool: ocx-validate

A command-line tool for validating OCX files and packages.

```bash
# Validate OCX JSON files
npx --package @learningtapestry/ocx-tools ocx-validate course.ocx.json lesson.ocx.json

# Validate OCX packages (.ocx.zip)
npx --package @learningtapestry/ocx-tools ocx-validate curriculum.ocx.zip

# Validate references within packages
npx --package @learningtapestry/ocx-tools ocx-validate --check-references curriculum.ocx.zip

# Output results as JSON
npx --package @learningtapestry/ocx-tools ocx-validate --json course.ocx.json

# Combine flags
npx --package @learningtapestry/ocx-tools ocx-validate --json --check-references curriculum.ocx.zip
```

### Validation Checks

**OCX File Validation:**
- File passes schema validation

**Package Validation (always runs):**
- Manifest exists and is valid
- Format version is supported (`^1.0.0`)
- All referenced files exist in the package
- All OCX files pass schema validation
- All `@id` values are unique (no duplicates)

**Reference Validation (opt-in with `--check-references`):**
- All `@link` references resolve to entities in the package
- Referenced entity `@type` matches the link's declared type

Exit code is 0 if all files are valid, 1 otherwise.

## Development
`npm run generate-schema` regenerates `ocx.schema.json`, `ocx.d.ts`, and ArkType definitions from the ontology files.
