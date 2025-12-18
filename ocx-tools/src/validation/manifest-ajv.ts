import Ajv from "ajv";
import manifestSchema from "../manifest.schema.json" with { type: "json" };

const ajv = new Ajv({ strict: false, allErrors: true });

export const validate = ajv.compile(manifestSchema);

export default validate;
