# K-12 OCX Binding

Instances of the [01_ontology.md](ontology) types can be encoded as JSON according to the following
[JSON Schema](https://json-schema.org/):

[OCX JSON schema](/ocx-tools/src/ocx.schema.json)

We recommend naming OCX JSON files as `<filename>.ocx.json`.

## Additional required properties

Aside from the properties defined in the ontology, the JSON representation requires the properties
`@id` and `@type` to be defined in top-level entities.

## OCX links

Relationships in the JSON representations can be expressed in two ways:

1) With an embedded object. For example, a `Course` may have multiple `Material` in its `hasPart` relationship
2) With a link. Aside from embedding `Material` resources, the `Course` may include `link` objects in its `hasPart`.

```json
{ "link": { "@type": "Material", "@id": "material-1" } }
```

### Educational alignment links

Links in a `hasEducationalAlignment` relationship may include a
`curriculumAlignmentType` property on the relationship object. This property
classifies how the source curriculum element engages with the linked standard,
competency, or learning goal.

```json
{
  "link": {
    "@type": "StandardsFrameworkItem",
    "@id": "standard-1"
  },
  "curriculumAlignmentType": "building_towards"
}
```

The property is optional because source curricula do not always distinguish the
kind of alignment. Producers MUST NOT infer a value when the source data does
not support one. Allowed values are `addressing`, `building_towards`, `focus`,
`supporting`, `intentionally_developed`, `key_use`, and `not_a_focus`.
