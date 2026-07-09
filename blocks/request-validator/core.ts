import { z } from "zod";
/**
 * Validates arbitrary data against a Zod schema.
 *
 * Returns the parsed data when validation succeeds.
 * Throws a ValidationError when validation fails.
 */
export function coreValidator<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  data: unknown
): z.infer<TSchema> {
  return schema.parse(data);
}
