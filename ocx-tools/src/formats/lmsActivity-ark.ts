import { type } from "arktype";

export const LmsActivity = type({
  name: "string",
  description: "string",
});

export type LmsActivity = typeof LmsActivity.infer;

export default LmsActivity;
