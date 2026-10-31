# Diário da execução noturna de 30 para 31/10/2026

Pedido do usuário (30/10/2026, à noite): rodar todos os testes do `apps/web` (e2e, tela, UI/UX), validar todos os fluxos, principalmente os de valores (cobranças, financeiro, relatórios), e a segurança dos dados pessoais; corrigir o que achar e seguir; vigiar a memória do Mac; nada do `apps/admin`; registrar decisões para validar de manhã. Branch: `main` (commit sozinho, sem push). Ao retomar, leia este diário e siga do primeiro item sem "feito".

## Como rodou

- Mac: 16 GB. Memória conferida antes de cada bloco (`memory_pressure`); e2e sobre o build de produção (`E2E_SERVER=prod`), uma área por vez.
- Banco: Supabase local. Asaas: só o sandbox (o e2e roda sem chave). Nada de produção.

## Andamento

| Item | Estado | Commit | Resultado | Observações |
| --- | --- | --- | --- | --- |
| Preparação (Mac acordado, memória, banco) | feito | — | 16 GB, 77% livres; Supabase no ar; árvore limpa em `8f92ec0` | |
| Suítes rápidas e de banco | feito | — | core 302, Vitest 1279, banco 175: todos verdes | |
| e2e cobranças (7 specs) | feito | `373841c` | 46 passaram, 1 falhou (corrigido), 1 pulado de propósito | O pulado é o Pix Automático, que ainda não tem tabelas no banco (doc 15) |
| Guia na tela (pedido da noite) | feito | `e500395` | typecheck, lint, Vitest; e2e novo roda no próximo build | |

## Bugs corrigidos

1. **Comunicação: trocar de aba às vezes ficava na aba antiga** (`373841c`). A aba tinha ido para o endereço hoje (`?tab=`), e cada troca virou uma navegação ao servidor; dois toques seguidos disputavam e a tela ficava no Histórico. Agora a troca usa o `history.replaceState` do navegador (sem servidor): instantânea e sem disputa. Achado pelo e2e `dinheiro-cobrancas`.
2. **Guia na tela travava ao avançar sem clicar** (`e500395`, relatado por você). Detalhes em "Melhorias".

## Melhorias feitas

1. **Guia na tela ("Me mostre na tela") para quem não é do ramo** (`e500395`). Passo que pede clique (botão, aba, menu, item) não tem mais "Próximo": a pessoa clica no destaque ou toca em **"Fazer por mim"**, que clica por ela, e o guia só segue com a tela pronta (janela aberta, menu aberto). Botão desligado avisa. Se o alvo some, o balão diz "Não achei isso na tela agora" e oferece "Voltar" e "Pular este passo". Escolhi não trocar por biblioteca (driver.js, Shepherd, Joyride): elas têm o mesmo problema de sincronizar com a janela que abre e exigiriam a mesma lógica; o guia atual já acha os alvos pelo texto da tela. e2e novo: `guia-na-tela`.

## Decisões tomadas por mim, para validar

(nenhuma ainda)

## Segurança

(auditoria em andamento)

## O que ficou de fora

(a preencher no fim)
