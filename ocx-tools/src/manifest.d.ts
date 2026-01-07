import type { LanguageENUM, OcxEntityType } from "./ocx";

export interface ManifestContentEntry {
  path: string;
  name?: string;
  description?: string;
  type?: OcxEntityType;
}

export interface Manifest {
  "@id": string;
  name?: string;
  description?: string;
  inLanguage?: LanguageENUM;
  format: `ocx@${string}`;
  contents: ManifestContentEntry[];
}
