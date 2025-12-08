import Ajv from "ajv";
import ocxSchema from "../ocx.schema.json";

const ajv = new Ajv({ strict: false, allErrors: true });

ajv.addFormat("date-time", {
  type: "string",
  validate: (value: string) => !Number.isNaN(Date.parse(value)),
});

const validate = ajv.compile(ocxSchema);

export default validate;
