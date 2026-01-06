import Ajv from "ajv";
import lmsActivitySchema from "./lmsActivity.schema.json" with { type: "json" };

const ajv = new Ajv({ strict: false, allErrors: true });

export const validate = ajv.compile(lmsActivitySchema);

export default validate;
