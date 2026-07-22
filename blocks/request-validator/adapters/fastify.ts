import { z, ZodError } from "zod";
import type { FastifyReply, FastifyRequest } from "fastify";

import { coreValidator } from "../core";
import type { RequestValidationSchema } from "../contract";

export interface FastifyValidatorOptions {
  propagateErrors?: boolean;
}

export const VALIDATED_KEY = Symbol("blockend.validated");

type ValidatedData<
  TBody extends z.ZodTypeAny,
  TQuery extends z.ZodTypeAny,
  TParams extends z.ZodTypeAny
> = {
  body: z.infer<TBody>;
  query: z.infer<TQuery>;
  params: z.infer<TParams>;
};

interface ValidatedRequest<
  TBody extends z.ZodTypeAny,
  TQuery extends z.ZodTypeAny,
  TParams extends z.ZodTypeAny
> extends FastifyRequest {
  [VALIDATED_KEY]?: ValidatedData<TBody, TQuery, TParams>;
}

type ValidatorHook<
  TBody extends z.ZodTypeAny,
  TQuery extends z.ZodTypeAny,
  TParams extends z.ZodTypeAny
> = {
  (request: FastifyRequest, reply: FastifyReply): Promise<void>;

  validated(request: FastifyRequest): ValidatedData<TBody, TQuery, TParams>;
};

export function fastifyValidator<
  TBody extends z.ZodTypeAny = z.ZodTypeAny,
  TQuery extends z.ZodTypeAny = z.ZodTypeAny,
  TParams extends z.ZodTypeAny = z.ZodTypeAny
>(
  schemas: RequestValidationSchema<TBody, TQuery, TParams>,
  options: FastifyValidatorOptions = {}
): ValidatorHook<TBody, TQuery, TParams> {
  const hook = async (request: FastifyRequest, reply: FastifyReply) => {
    const validatedReq = request as ValidatedRequest<TBody, TQuery, TParams>;

    try {
      const body = coreValidator(schemas.body ?? z.any(), request.body);

      const query = coreValidator(schemas.query ?? z.any(), request.query);

      const params = coreValidator(schemas.params ?? z.any(), request.params);

      request.body = body;
      request.query = query;
      request.params = params;

      validatedReq[VALIDATED_KEY] = {
        body,
        query,
        params
      };
    } catch (err) {
      if (err instanceof ZodError) {
        if (options.propagateErrors) {
          throw err;
        }

        return reply.status(400).send({
          success: false,
          data: null,
          message: "Validation failed",
          errors: z.flattenError(err).fieldErrors
        });
      }

      throw err;
    }
  };

  hook.validated = (request: FastifyRequest): ValidatedData<TBody, TQuery, TParams> => {
    const validatedReq = request as ValidatedRequest<TBody, TQuery, TParams>;

    const data = validatedReq[VALIDATED_KEY];

    if (!data) {
      throw new Error("[blockend] fastifyValidator has not run for this request.");
    }

    return data;
  };

  return hook as ValidatorHook<TBody, TQuery, TParams>;
}
