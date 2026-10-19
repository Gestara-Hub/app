import { createFunctionApp } from "../_shared/http.ts";
import { formatCents } from "@gestarahub/core/format";

const app = createFunctionApp("health");

app.get("/", (c) => {
  return c.json({
    ok: true,
    service: "gestarahub-edge",
    sampleFormat: formatCents(16000),
    timestamp: new Date().toISOString(),
  });
});

Deno.serve(app.fetch);
