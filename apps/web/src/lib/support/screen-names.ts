/**
 * Nome de cada tela como aparece no título da página (o `<h1>` / `PageHeader`),
 * pela rota que os artigos de docs/ajuda declaram em `Onde:`. A ajuda usa estes
 * nomes no lugar do nome do artigo. Tela nova com artigo: acrescente aqui (o
 * teste de help-search reprova a rota sem nome).
 */
const SCREEN_NAMES: Record<string, string> = {
  "/dashboard": "Painel",
  "/classes": "Turmas",
  "/classes/calendar": "Calendário de turmas",
  "/classes/modalities": "Modalidades",
  "/audit": "Auditoria",
  "/classes/billing": "Cobranças",
  "/classes/plans": "Planos e pacotes",
  "/certificates": "Certificados",
  "/clients": "Alunos",
  "/team": "Equipe",
  "/finance": "Financeiro",
  "/communication": "Comunicação",
  "/reports": "Relatórios",
  "/online-payments": "Recebimentos online",
  "/plans": "Planos e Assinatura",
  "/settings": "Configurações",
};

/** Nome da tela da rota (a query é ignorada), ou `undefined` se a rota não tem nome. */
export function screenName(route: string | undefined): string | undefined {
  return route ? SCREEN_NAMES[route.split("?")[0]] : undefined;
}
