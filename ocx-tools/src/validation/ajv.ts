import Ajv from "ajv";
import ocxSchema from "../ocx.schema.json" with { type: "json" };

const ajv = new Ajv({ strict: false, allErrors: true });

ajv.addFormat("date-time", {
  type: "string",
  validate: (value: string) => !Number.isNaN(Date.parse(value)),
});

export const validate = ajv.compile(ocxSchema);

export default validate;
