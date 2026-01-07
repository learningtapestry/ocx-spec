import { type } from "arktype";

export const LmsActivity = type({
  title: "string",
  content: "string",
});

export type LmsActivity = typeof LmsActivity.infer;

export default LmsActivity;
