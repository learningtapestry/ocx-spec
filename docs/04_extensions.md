# OCX Extensions

OCX extends the Learning Commons Knowledge Graph with additional entities and properties that support curriculum-specific needs.

## Material Extensions

### hasRepresentation

The `hasRepresentation` property connects a Material to its format variants.

| Property | Type | Include | Cardinality | Description |
| :---- | :---- | :---- | :---- | :---- |
| isProgressive | Boolean | MAY | 0..1 | TRUE if the Material is meant to be developed or revisited across multiple lessons |
| hasRepresentation | Representation | MAY | 0..n | Links to one or more Representation objects that provide access to the Material in different formats |

## Representation

A **Representation** is a digital or physical media object that embodies a specific version, format, or instance of a Material. Unlike other entities that inherit from LearningResource, Representation is intentionally minimal - most educational metadata belongs on the parent Material.

Representations are always embedded within a Material's `hasRepresentation` array. The relationship is implicit from the structure.

### Properties

| Field | Type | Include | Description |
| :---- | :---- | :---- | :---- |
| @id | URL/Text | MUST | Unique identifier for this representation |
| @type | Text | MUST | Must be "Representation" |
| identifier | Text/URL | MUST | The identifier of the item |
| encodingFormat | Text | MUST | MIME type (e.g., 'application/pdf', 'text/html') |
| accessResource | Text/URL | MUST | URL, path, or inline content providing access to the resource |
| preferred | Boolean | MAY | TRUE if this is the preferred representation among multiple formats |
| isOcxGenerated | Boolean | SHOULD | TRUE if generated during OCX packaging, FALSE if from source system |
| lmsLoadingGuidance | lmsLoadingGuidanceENUM | MAY | Vendor guidance on LMS inclusion |
| name | Text | MAY | Name of the representation (e.g., "Spanish PDF") |
| description | Text | MAY | Description of the representation |
| inLanguage | LanguageENUM | MAY | Language, if different from the parent Material |
| dateCreated | DateTime | MAY | When this representation was created |
| dateModified | DateTime | MAY | When this representation was last modified |

### Content Validation

When a Representation's `encodingFormat` matches a registered format validator, the content at `accessResource` can be validated during package validation. See [05_representation_formats.md](05_representation_formats.md) for supported formats.

### Example

```json
{
  "@type": "Material",
  "@id": "urn:ocx:material-handout-1",
  "identifier": "unit1.lesson3.handout",
  "name": "Variables and Expressions Handout",
  "educationalUse": "Instruction",
  "hasRepresentation": [
    {
      "@type": "Representation",
      "@id": "urn:ocx:rep-docx",
      "identifier": "unit1.lesson3.handout.docx",
      "encodingFormat": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "accessResource": "assets/handouts/variables-expressions.docx",
      "isOcxGenerated": false,
      "lmsLoadingGuidance": "Not Recommended"
    },
    {
      "@type": "Representation",
      "@id": "urn:ocx:rep-pdf",
      "identifier": "unit1.lesson3.handout.pdf",
      "encodingFormat": "application/pdf",
      "accessResource": "assets/handouts/variables-expressions.pdf",
      "preferred": true,
      "isOcxGenerated": true,
      "lmsLoadingGuidance": "Recommended"
    },
    {
      "@type": "Representation",
      "@id": "urn:ocx:rep-pdf-es",
      "identifier": "unit1.lesson3.handout.es.pdf",
      "encodingFormat": "application/pdf",
      "accessResource": "assets/handouts/variables-expressions-es.pdf",
      "isOcxGenerated": true,
      "lmsLoadingGuidance": "Optional",
      "inLanguage": "es-US",
      "name": "Spanish PDF"
    }
  ]
}
```
