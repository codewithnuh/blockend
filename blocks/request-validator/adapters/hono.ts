import { z, ZodError } from "zod";
import type { Context, MiddlewareHandler } from "hono";

import { coreValidator } from "../core";
import type { RequestValidationSchema } from "../contract";

type HonoValidatorOptions = {
  /**
   * When true, throws the ZodError so Hono's error handler can catch it.
   * Otherwise returns a 400 response.
   */
  propagateErrors?: boolean;
};

export type ValidatedData<
  TBody extends z.ZodTypeAny,
  TQuery extends z.ZodTypeAny,
  TParams extends z.ZodTypeAny
> = {
  body: z.infer<TBody>;
  query: z.infer<TQuery>;
  params: z.infer<TParams>;
};

const VALIDATED_KEY = "blockend.validated";

export function honoValidator<
  TBody extends z.ZodTypeAny = z.ZodTypeAny,
  TQuery extends z.ZodTypeAny = z.ZodTypeAny,
  TParams extends z.ZodTypeAny = z.ZodTypeAny
>(
  schemas: RequestValidationSchema<TBody, TQuery, TParams>,
  options: HonoValidatorOptions = {}
): MiddlewareHandler {
  return async (c, next) => {
    try {
      const bodySchema = schemas.body ?? z.any();
      const querySchema = schemas.query ?? z.any();
      const paramsSchema = schemas.params ?? z.any();

      const body = coreValidator(bodySchema, await c.req.json().catch(() => undefined));

      const query = coreValidator(
        querySchema,
        Object.fromEntries(new URL(c.req.url).searchParams.entries())
      );

      const params = coreValidator(paramsSchema, c.req.param());

      c.set(VALIDATED_KEY, {
        body,
        query,
        params
      });

      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        if (options.propagateErrors) {
          throw error;
        }

        return c.json(
          {
            success: false,
            data: null,
            message: "Validation failed",
            errors: z.flattenError(error).fieldErrors
          },
          400
        );
      }

      throw error;
    }
  };
}

export function validated<
  TBody extends z.ZodTypeAny,
  TQuery extends z.ZodTypeAny,
  TParams extends z.ZodTypeAny
>(c: Context): ValidatedData<TBody, TQuery, TParams> {
  const data = c.get(VALIDATED_KEY);

  if (!data) {
    throw new Error(
      "[blockend] honoValidator middleware has not run for this request. " +
        "Ensure it is registered before your route handler."
    );
  }

  return data as ValidatedData<TBody, TQuery, TParams>;
}
