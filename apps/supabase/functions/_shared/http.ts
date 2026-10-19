import { Hono } from "hono";
import { cors } from "hono/cors";
import { ApiError } from "@gestarahub/contracts";

/**
 * Creates a Hono app pre-configured with CORS and the standard GestaraHub
 * ApiError handler so Edge Functions return the exact same error payload
 * (`{ code, message, fields }`) expected by the frontend.
 */
export function createFunctionApp(basePath: string) {
  const app = new Hono().basePath(`/${basePath}`);

  app.use(
    "*",
    cors({
      origin: "*",
      allowHeaders: ["authorization", "x-client-info", "apikey", "content-type"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  );

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(err.toJSON(), err.httpStatus as 400 | 401 | 403 | 404 | 409 | 422);
    }
    console.error(`[${basePath}] Unhandled error:`, err);
    return c.json(
      {
        code: "INTERNAL_ERROR",
        message: "Erro inesperado no servidor. Tente novamente.",
      },
      500,
    );
  });

  return app;
}
