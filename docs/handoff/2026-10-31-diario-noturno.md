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
| e2e financeiro, relatórios e plano | feito | — | 43 passaram, 1 pulado de propósito | Pulado: troca para plano maior (`test.fixme` antigo); rotina e webhook do plano pulam sem `CRON_SECRET`/`ASAAS_WEBHOOK_SECRET` no `.env.local` |
| e2e resto do desktop (28 specs) | feito | vários | 286 passaram, 12 falharam; refeitas: 2 sobraram, 1 corrigida | Falhas por migração no meio da rodada (build antigo), testes desatualizados e 1 defeito (troca de aba). Em aberto: entrar de novo no dispositivo lembrado (`verificacao-email`) |
| Revisão de valores (agente) | parcial | `745b0d9` | 6 achados + suspeitas | Corrigido o nº 1 (código Pix antigo). Faltam: baixa em cancelada (4), clearCharges (5), Mês cheio ao reativar (2), DRE x Financeiro (3), fuso nos totais (6) |
| Auditoria de segurança (agente) | em andamento | `b4a62e0`, `cd7f630`, `10747ed`, `a759374`, `4ad3799`, `db5048d` | 1 crítico, 5 altos, 9 médios, baixos | Feitos: C1, H1, H2, H3, H4, H5, M1, M2, M3, M4, M5. Faltam: M6 a M9 e baixos |

## Bugs corrigidos

1. **Comunicação: trocar de aba às vezes ficava na aba antiga** (`373841c`). A aba tinha ido para o endereço hoje (`?tab=`), e cada troca virou uma navegação ao servidor; dois toques seguidos disputavam e a tela ficava no Histórico. Agora a troca usa o `history.replaceState` do navegador (sem servidor): instantânea e sem disputa. Achado pelo e2e `dinheiro-cobrancas`.
2. **Guia na tela travava ao avançar sem clicar** (`e500395`, relatado por você). Detalhes em "Melhorias".
3. **Código Pix ou link antigo reativava cobrança cancelada e cobrava em dobro** (`745b0d9`). Troca de plano, desconto, bolsa, pausa, inativação e saída da aula avulsa cancelavam a cobrança, mas o Pix já enviado pelo WhatsApp seguia valendo (até 30 dias). Pago, o webhook marcava a cobrança cancelada como paga ao lado da substituta (cobrança em dobro), ou a baixa batia no índice do período e o dinheiro não entrava no Financeiro; pago em dinheiro virava Pix. Agora esses cancelamentos cancelam o código (banco e Asaas) e o webhook só dá baixa em cobrança em aberto; senão, a cobrança fica como estava e o dono recebe um aviso na Auditoria para devolver ou combinar o valor.
4. **Troca de botão de conectar o WhatsApp com jargão** (`d933eb5`): "Conectar via Popup da Meta" e "Conectar modo Sandbox (Ambiente local)" viraram um botão só, "Conectar WhatsApp oficial"; o de "Sandbox" aparecia para clientes.
5. **e2e mandava WhatsApp de verdade** (`a991d5f`): com as credenciais da Meta no `.env.local`, o envio oficial do e2e chamava a API real para números de teste. O servidor do e2e agora zera essas variáveis, como já fazia com Asaas e e-mail.

## Melhorias feitas

1. **Guia na tela ("Me mostre na tela") para quem não é do ramo** (`e500395`). Passo que pede clique (botão, aba, menu, item) não tem mais "Próximo": a pessoa clica no destaque ou toca em **"Fazer por mim"**, que clica por ela, e o guia só segue com a tela pronta (janela aberta, menu aberto). Botão desligado avisa. Se o alvo some, o balão diz "Não achei isso na tela agora" e oferece "Voltar" e "Pular este passo". Escolhi não trocar por biblioteca (driver.js, Shepherd, Joyride): elas têm o mesmo problema de sincronizar com a janela que abre e exigiriam a mesma lógica; o guia atual já acha os alvos pelo texto da tela. e2e novo: `guia-na-tela`.

## Decisões tomadas por mim, para validar

(nenhuma ainda)

## Segurança

Um agente auditou o código (só leitura) e eu confirmei cada achado no banco local antes de corrigir. O risco comum: **o token da sessão do Supabase fica num cookie do navegador**, e com ele (ou com a chave pública) qualquer um chama o banco direto pelo PostgREST, sem passar pelo app.

| Achado | Gravidade | O que era | Como ficou | Commit |
| --- | --- | --- | --- | --- |
| C1 | crítica | Qualquer membro, até professor, lia a chave do Asaas do espaço e podia mover o dinheiro | Coluna fora do alcance de quem usa o app (migração 69) | `b4a62e0` |
| H1 | alta | Dono e gerente gravavam direto plano pago, situação do espaço e carteira do repasse; membro inseria Pix próprio e consentimento | Escrita direta fechada; só o servidor grava | `b4a62e0` |
| H2 | alta | Cookie do app sem assinatura; ações confiavam só nele (termo impresso de qualquer aluno, consentimento forjado, configuração do espaço) | Cookie assinado (HMAC) e as ações conferem sessão, permissão e espaço | `10747ed` |
| H3 | alta | Só com a senha (antes do código) o banco entregava os alunos, e dava para cadastrar outro autenticador e tomar a conta | Verificação em duas etapas também no banco (migração 70) e para mudar a verificação | `cd7f630` |
| H4 | alta | Professor listava todos os alunos do espaço, com CPF | Só os alunos das turmas dele, sem CPF, plano nem endereço | `a759374` |
| H5 | alta | Sem login, dava para zerar o limite de tentativas (senha e código ilimitados) | Funções só do servidor | `b4a62e0` |
| M1, M2 | média | Funções e tabelas de turma graváveis direto (professor apagava matrícula) | Só o servidor | `b4a62e0` |
| M3 | média | Preferências abertas a todos, até sem login | Fechadas; usuário vem da sessão | `b4a62e0` |
| M4 | média | Pix/link aceitavam do navegador a taxa do GestaraHub (podia ser 0), a chave e o valor; sem cobrança, caíam na conta principal | Tudo conferido no servidor | `4ad3799` |
| M5 | média | Cadastro aceitava autorização do menor "pelo WhatsApp" e graduação vindas do navegador | O servidor decide | `db5048d` |

**Para você fazer:** se alguma chave real de subconta do Asaas já existiu num banco com essa falha, troque a chave no Asaas (a exposição era para membros do próprio espaço). Ao publicar, as sessões abertas caem uma vez (cookie novo, assinado): todos entram de novo.

## O que ficou de fora

(a preencher no fim)
