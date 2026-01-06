/**
 * LMS Activity content format.
 *
 * Used as the content for Representations with
 * encodingFormat: "application/vnd.ocx.lmsActivity+json"
 */
export interface LmsActivity {
  /** The name of the LMS activity */
  name: string;
  /** A description of the LMS activity */
  description: string;
}
