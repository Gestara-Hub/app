import { vi } from "vitest";
import { sessionClient } from "./db";

// As server actions pegam o cliente da sessao aqui; no teste, e o usuario logado.
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => sessionClient(),
}));
