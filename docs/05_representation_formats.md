# Representation Formats

This document describes format-specific schemas for content referenced by OCX Representations.

## Overview

OCX Representations reference external content files via the `accessResource` property. When content follows a recognized format (identified by `encodingFormat`), validators can verify that the content conforms to the expected schema.

## LMS Activity Format

**MIME Type:** `application/vnd.ocx.lmsActivity+json`

The LMS Activity format represents minimal structured activity metadata for Learning Management Systems. It is designed to be the simplest possible representation of an activity that an LMS needs to display and track.

### Schema

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| title | String | Yes | The title of the LMS activity |
| content | String | Yes | The content of the LMS activity |

### Example

```json
{
  "title": "Variables Quiz",
  "content": "Test your understanding of algebraic variables and expressions"
}
```

### Usage in Representation

```json
{
  "@type": "Material",
  "@id": "urn:ocx:material-quiz",
  "identifier": "unit1.lesson3.quiz",
  "name": "Variables Quiz Material",
  "hasRepresentation": [
    {
      "@type": "Representation",
      "@id": "urn:ocx:rep-lms-activity",
      "identifier": "variables-quiz",
      "encodingFormat": "application/vnd.ocx.lmsActivity+json",
      "accessResource": "activities/quiz.lmsActivity.json"
    }
  ]
}
```

### Validation

Content validation is performed during package validation when `validateContent: true` is set:

```typescript
import { validatePackage } from "ocx-tools/validation/package";

const result = await validatePackage("package.ocx.zip", { validateContent: true });
```

Or via CLI:

```bash
ocx-validate --validate-content package.ocx.zip
```

## Adding New Formats

To add support for additional content formats:

1. Create schema files in `ocx-tools/src/formats/`:
   - `<format>.schema.json` - JSON Schema definition
   - `<format>.d.ts` - TypeScript type definitions
   - `<format>-ajv.ts` - AJV validator
   - `<format>-ark.ts` - ArkType validator

2. Register the validator in `ocx-tools/src/validation/package.ts`:
   ```typescript
   import validateNewFormat from "../formats/<format>-ajv.js";

   const contentValidators = new Map<string, ValidateFunction>([
     ["application/vnd.ocx.lmsActivity+json", validateLmsActivity],
     ["application/vnd.ocx.<format>+json", validateNewFormat],
   ]);
   ```

3. Add tests in `test/formats/` and integration tests in `test/validation/package.test.ts`

4. Update this documentation with the new format specification
