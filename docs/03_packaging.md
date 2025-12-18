# K-12 OCX Packaging

An OCX package or bundle is a Zip file with a number of [JSON-encoded](02_binding.md) OCX entities
and a manifest file.

The OCX entities contained in the package are expected to be related:
a package is typically used to transfer a whole set of lesson groupings.

We recommend naming OCX package files `<filename>.ocx.zip`.

## Manifest file

The manifest file **must** be named:

    manifest.json

This file is **required** for every OCX package.

### Top‑Level Properties

#### `name` *(optional)*

A human‑readable, descriptive name for the OCX package.

#### `description` *(optional)*

A brief description of the contents in the OCX package.

#### `format` *(required)*

Specifies the manifest format version.

    ocx@<semver>

Only `ocx` is supported as the format namespace.

#### `contents` *(required)*

An array of file entry objects describing the files included in the
package.

---

Each `contents` entry supports the following fields:

#### `path` *(required)*

Path to the file.
Use relative paths if your package is organized into directories.

#### `name` *(optional)*

A descriptive, user‑friendly title for the OCX file.

#### `description` *(optional)*

A brief description of the contents in the OCX file.

#### `type` *(optional)*

The OCX entity type represented by the file.

## JSON Schema

A schema for the manifest's JSON format is available here:

[JSON Schema for manifest.json](/ocx-tools/src/manifest.schema.json)

## Example

```js
{
  "$schema": "https://path/to/ocx/manifest.schema.json",
  "name": "Grade 1 ELA Unit 1",
  "format": "ocx@1.0.0",
  "contents": [
    {
      "path": "unit_01.ocx.json",
      "name": "Unit 1 - Listening and Learning",
      "type": "LessonGrouping"
    },
    {
      "path": "lessons/lesson_01.ocx.json",
      "name": "Lesson 1 - The Little Prince",
      "description": "Students will learn about the novella The Little Prince",
      "type": "Lesson"
    },
    // ...
  ]
}
```
