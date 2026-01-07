/**
 * LMS Activity content format.
 *
 * Used as the content for Representations with
 * encodingFormat: "application/vnd.ocx.lmsActivity+json"
 */
export interface LmsActivity {
  /** The title of the LMS activity */
  title: string;
  /** The content of the LMS activity */
  content: string;
}
