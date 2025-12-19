# ocx-tools
ocx-tools packages the K-12 OCX JSON schema, TypeScript types, and optional preconfigured validators for Node.js.

Requires Node 20+.

## Working with the type library

Static typing for OCX entities so your code gets proper shapes and autocompletion.

```bash
npm install ocx-tools
```

```ts
import type { Course } from "ocx-tools/ocx";

function CourseComponent({ course }: { course: Course }) {
  // ...
}
```

## Working with ArkType

Fast runtime validation with [ArkType](https://arktype.io/).


The dependency on ArkType is optional; only install it if you need it.

```bash
npm install ocx-tools arktype
```

```ts
import ocx from "ocx-tools/validation/ark";

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

The dependency on AJV is optional; only install it if you need it.

```bash
npm install ocx-tools ajv
```

```ts
import validate from "ocx-tools/validation/ajv";

// ... get `ocxData` from somewhere ...

if (!validate(ocxData)) {
  console.error(validate.errors);
}
```

The JSON schema is also directly available [here](src/ocx.schema.json). You can use it as follows:

```ts
import Ajv from "ajv";
import ocxSchema from "ocx-tools/ocx.schema.json" with { type: "json" };

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
npx ocx-validate course.ocx.json lesson.ocx.json

# Validate OCX packages (.ocx.zip)
npx ocx-validate curriculum.ocx.zip

# Output results as JSON
npx ocx-validate --json course.ocx.json

# Mix files and packages
npx ocx-validate course.ocx.json curriculum.ocx.zip
```

Package validation checks:
- Manifest exists and is valid
- Format version is supported (`^1.0.0`)
- All referenced files exist
- All OCX files pass schema validation

Exit code is 0 if all files are valid, 1 otherwise.

## Development
`npm run generate-schema` regenerates `ocx.schema.json`, `ocx.d.ts`, and ArkType definitions from the ontology files.
