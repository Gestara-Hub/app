import { config } from "zod/v4/core";

// CSP sem 'unsafe-eval' (31/10/2026): o Zod 4 testa `new Function` para o JIT,
// e o navegador registra o teste como violacao mesmo com o erro capturado. Sem
// o JIT, a validacao e a mesma, so um pouco mais lenta em objetos grandes.
// So o `config` do nucleo (11/11/2026): importar o `z` inteiro aqui puxava o Zod
// todo, com as linguas, para toda pagina antes da hidratacao (~64 KB gzip),
// inclusive as paginas publicas sem formulario. A configuracao e a mesma.
config({ jitless: true });
