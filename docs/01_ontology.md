# K-12 OCX Ontology

The K-12 OCX ontology is the conceptual model used by the spec to define what is being transferred.
More practically, it is the description of entities and their properties that will compose OCX data.

## Knowledge Graph

Our ontology is a superset of the [Learning Commons Knowledge Graph's Curriculum dataset](https://docs.learningcommons.org/knowledge-graph/v1-2-0/entity-and-relationship-reference/curriculum).

> Knowledge Graph is a structured collection of datasets that connects academic standards, curricula, and learning science data. By bringing quality datasets together, enriching them, and unifying the schema, Knowledge Graph enables edtech developers to focus on building instructional tools and AI-powered experiences that can improve teaching and learning.

> The Curriculum dataset comprises Lessons, activities, materials, and assessments from publishers.

While the core entities are the same as the ones in the Knowledge Graph, we decorate it with a handful of extensions.

## OCX Extensions to the Knowledge Graph

See [04_extensions.md](04_extensions.md) for OCX-specific extensions including Representation.

## Representation Formats

See [05_representation_formats.md](05_representation_formats.md) for format-specific validation of content referenced by Representations.
