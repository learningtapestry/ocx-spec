# ocx-tools
ocx-tools packages the K-12 OCX JSON schema, TypeScript types, and optional preconfigured validators for Node.js.

Requires Node 20+.

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

## Working with ArkType

Fast runtime validation with ArkType; good for lightweight checks or dev-time assertions (optional peer).

```bash
npm install @learningtapestry/ocx-tools arktype
```

```ts
import ocx from "@learningtapestry/ocx-tools/validation/ark";

const result = ocx.OcxEntity(ocxData);
```

## Working with AJV

A precompiled AJV validator is available if you'd like to work with JSON Schema-based validation (optional peer).

```bash
npm install @learningtapestry/ocx-tools ajv
```

```ts
import validate from "@learningtapestry/ocx-tools/validation/ajv";

if (!validate(ocxData)) {
  console.error(validate.errors);
}
```

The JSON schema is also directly available:

```ts
import Ajv from "ajv";
import ocxSchema from "@learningtapestry/ocx-tools/ocx.schema.json";

const ajv = new Ajv({ strict: false, allErrors: true });

ajv.addFormat("date-time", {
  type: "string",
  validate: (value: string) => !Number.isNaN(Date.parse(value)),
});

export const validate = ajv.compile(ocxSchema);
```

## Development
`npm run generate-schema` regenerates `ocx.schema.json`, `ocx.d.ts`, and ArkType definitions from the ontology files.
