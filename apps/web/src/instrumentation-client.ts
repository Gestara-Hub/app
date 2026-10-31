// Roda no navegador antes do codigo do app e da hidratacao: a configuracao do
// Zod precisa vir antes do primeiro `z.object` (CSP sem 'unsafe-eval').
import "./lib/zod-config";
