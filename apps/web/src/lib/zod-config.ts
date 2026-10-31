import { z } from "zod";

// CSP sem 'unsafe-eval' (31/10/2026): o Zod 4 testa `new Function` para o JIT,
// e o navegador registra o teste como violacao mesmo com o erro capturado. Sem
// o JIT, a validacao e a mesma, so um pouco mais lenta em objetos grandes.
z.config({ jitless: true });
