# K-12 OCX Ontology

The K-12 OCX ontology is the conceptual model used by the spec to define what is being transferred.
More practically, it is the description of entities and their properties that will compose OCX data.

## Knowledge Graph

Our ontology is a superset of the [Learning Commons Knowledge Graph's Curriculum dataset](https://docs.learningcommons.org/knowledge-graph/v1-2-0/entity-and-relationship-reference/curriculum).

> Knowledge Graph is a structured collection of datasets that connects academic standards, curricula, and learning science data. By bringing quality datasets together, enriching them, and unifying the schema, Knowledge Graph enables edtech developers to focus on building instructional tools and AI-powered experiences that can improve teaching and learning.

> The Curriculum dataset comprises Lessons, activities, materials, and assessments from publishers.

While the core entities are the same as the ones in the Knowledge Graph, we decorate it with a handful of extensions.

## OCX Extensions to the Knowledge Graph

### Material Relationships

```txt
(:Material) - [:hasRepresentation] -> (:Representation)
```

### Representation

A representation is a digital or physical media object that embodies a specific version, format, or instance of a Material, making it accessible or consumable by users.

| Property | Description | Type | Include | Cardinality | Source |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Entity specific |  |  |  |  |  |
| identifier | The identifier of the item, either as textual strings or as URL (URI) links.  | [Text](https://schema.org/Text) or [URL](https://schema.org/URL) | MUST | 1 | Schema.org |
| encodingFormat | The digital media object type. Digital media type should be expressed using a MIME format (‘application/pdf’, ‘text/html’).  | [Text](https://schema.org/Text) or [URL](https://schema.org/URL) | MUST | 1 | Schema.org |
| accessResource | Provides access to a resource, either as a URL or system path pointing to the resource or as a text string embedding the resource's content. This property supports diverse formats and methods of access, including web-based URLs, app launch endpoints, or inline content like HTML. | [Text](https://schema.org/Text) or [URL](https://schema.org/URL) | MUST | 1 | CZI |
| preferred | A Material object may have multiple content objects that represent equivalent content (deemed a “good enough” match by the publisher) provided in different encodings (e.g., pdf and html). Set this property to TRUE if this content object is the preferred representation of the content.  | [Boolean](https://schema.org/Boolean) | MAY | 0..1 | CZI |
| isRepresentationOf | This relationship captures the connection between the abstract or conceptual description of a learning material (Material) and its concrete manifestations (Representation) | [Material]() | MUST | 1 | CZI |
| Inherited from [LearningResource]() |  |  |  |  |  |
| academicSubject | The academic subject; for example, ‘Physics’, ‘History’ | [AcademicSubjectENUM](#academicsubjectenum) | SHOULD | 0..1 | CZI |
| assesses | The item being described is specifically designed to evaluate the learner's mastery or achievement of the competency, learning goal, or outcome specified by the referenced term. This property should only be used for alignments within the same framework or context and must not be used for alignments to external frameworks. | [Text](https://schema.org/Text) | MAY | 0..n | Schema.org |
| audience | An intended audience, i.e. a group for whom something was created.  | [EducationalAudienceENUM](#educationalaudienceenum) | MUST | 1..n | Schema.org |
| [author](#author-&-provider) | The author of this content. | [Organization]() or [Person]() | MUST | 1 | Schema.org |
| [curriculumLabel](#—-curriculumlabel) | A curriculum-specific categorization of the resource. | [DefinedTerm](https://schema.org/DefinedTerm) or [Text](https://schema.org/Text) | SHOULD | 0..1 | CZI |
| [dateCreated](#—-datecreated-&-datemodified) | The date on which the element was created  | [Date](https://schema.org/Date) or [DateTime](https://schema.org/DateTime) | SHOULD | 0..1 | Schema.org |
| [dateModified](#—-datecreated-&-datemodified) | The date on which the element was most recently modified | [Date](https://schema.org/Date) or [DateTime](https://schema.org/DateTime)  | SHOULD | 0..1 | Schema.org |
| description | A description of the item. | [Text](https://schema.org/Text) | SHOULD | 0..1 | Schema.org |
| [educationalAlignment](#—-educationalalignment) | An alignment to an established educational framework. | [AlignmentObject]() | SHOULD | 0..n | Schema.org |
| [educationalUse](#—-educationaluse) | Describes the primary instructional function of a LearningResource within an educational context. This property classifies the resource based on whether it is used for delivering instruction or assessing student learning, ensuring a standardized categorization across curricula. | [EducationalUseENUM](#educationaluseenum) | SHOULD | 0..n | Schema.org |
| [gradeLevel](#—-gradelevel) | Specifies the educational grade for which the curriculum component is intended | [GradeLevelENUM](#gradelevelenum) | SHOULD | 0..n | CZI |
| hasPart | Indicates an item or CreativeWork that is part of this item, or CreativeWork (in some sense). Inverse property: isPartOf | [CreativeWork](https://schema.org/CreativeWork) | MAY | 0..n | Schema.org |
| identifier | The identifier of the item, either as textual strings or as URL (URI) links.  | [Text](https://schema.org/Text) or [URL](https://schema.org/URL) | MUST | 1 | Schema.org |
| [inLanguage](#—-inlanguage) | The language of the content or performance or used in an action. Please use one of the language codes from the IETF BCP 47 standard. | [Language](http://schema.org/Language) or [Text](https://schema.org/Text) | SHOULD | 0..1 | Schema.org |
| isOptional | Whether the curriculum element is optional to complete | [Boolean](http://schema.org/Boolean) | SHOULD | 0..1 | CZI |
| isPartOf | Indicates an item or CreativeWork that this item, or CreativeWork (in some sense), is part of. Inverse-property: hasPart | [CreativeWork](https://schema.org/CreativeWork) | MAY | 0..n | Schema.org |
| isReferencedBy | Indicates that this LearningResource is cited, linked, or conceptually referenced by another learning resource. This inverse relationship captures passive referencing without implying usage. | [LearningResource](#learningresource) | MAY | 0..n | CZI |
| license | A license document that applies to this content, typically indicated by URL. | [CreativeWork](https://schema.org/CreativeWork) or [URL](https://schema.org/URL) | MUST | 1 | Schema.org |
| [lmsLoadingGuidance](#—-lmsloadingguidance) | Indicates the vendor’s guidance regarding whether this learning resource should be included when loading content into a Learning Management System (LMS). This property is advisory and may be overridden by local implementation policies. The value is selected from a controlled vocabulary. | [lmsLoadingGuidanceENUM](#lmsloadingguidanceenum) | SHOULD | 0..1 | CZI |
| name | The name of the item. | [Text](https://schema.org/Text) | SHOULD | 0..1 | Schema.org |
| ordinalName | A label that combines the item's sequence number with descriptive text to indicate its order and context within a larger structure (e.g., 'Lesson 1', 'Chapter 2'). | [Text](https://schema.org/Text) | SHOULD | 0..1 |  |
| position | The position of an item in a series or sequence of items. | [Integer](http://schema.org/Integer) | SHOULD | 0..1 | Schema.org |
| [provider](#author-&-provider) | The service provider, service operator, or service performer; the goods producer. Another party (a seller) may offer those services or goods on behalf of the provider. A provider may also serve as the seller. | [Organization]() or [Person]() | MAY | 0..1 | Schema.org |
| references | Establishes a conceptual or informational link from one LearningResource to another. This relationship is used when the referenced item is cited, linked, or related in a supporting way but is not directly used or consumed during instruction. | [LearningResource](#learningresource) | MAY | 0..n | CZI |
| teaches | The item being described is intended to support the development of knowledge, skills, or competencies related to the specified learning goal, target, or outcome. This property should be used exclusively for alignments within the same framework or context and must not be used for alignments to external frameworks. | [Text](https://schema.org/Text) | MAY | 0..n | Schema.org |
| [timeRequired](#—-timerequired) | Approximate or typical time it usually takes to work with or through the content of this work for the typical or target audience. | [Duration](http://schema.org/Duration) | SHOULD | 0..1 | Schema.org |
| uses | Specifies that a learning resource (typically a lesson or activity) requires a particular classroom material to be present and used during instruction. This relationship applies when the material is physically needed to complete the instructional task. | [ClassroomMaterial]() | MAY | 0..1 | CZI |
