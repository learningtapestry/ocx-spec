# K-12 OCX Binding

Instances of the [01_ontology.md](ontology) types can be encoded as JSON according to the following
[JSON Schema](https://json-schema.org/):

[OCX JSON schema](https://github.com/learningtapestry/ocx-spec/ocx-tools/src/ocx.schema.json)

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
