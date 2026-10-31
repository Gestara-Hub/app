# Diário da execução noturna de 30 para 31/10/2026

Pedido do usuário (30/10/2026, à noite): rodar todos os testes do `apps/web` (e2e, tela, UI/UX), validar todos os fluxos, principalmente os de valores (cobranças, financeiro, relatórios), e a segurança dos dados pessoais; corrigir o que achar e seguir; vigiar a memória do Mac; nada do `apps/admin`; registrar decisões para validar de manhã. Branch: `main` (commit sozinho, sem push). Ao retomar, leia este diário e siga do primeiro item sem "feito".

## Resumo para a manhã

- **Testes:** e2e completo (computador e celular) verde no build de produção com tudo da noite: 414 passaram, 2 pulados de propósito e 1 corrida do próprio teste da landing, corrigida e repetida 3 vezes. Core 303 e Vitest 1311 verdes.
- **Valores:** 7 defeitos de dinheiro corrigidos, entre eles cobrança em dobro por Pix antigo, baixa em cobrança cancelada, "Mês cheio" cobrando duas vezes na volta, DRE diferente do Financeiro e recibo com o valor errado; 12 defeitos no total (Bugs corrigidos).
- **Segurança:** 1 falha crítica (chave do Asaas visível a qualquer membro), 5 altas e 9 médias corrigidas (Segurança). Na publicação, todos entram de novo uma vez.
- **Celular:** 21 telas revisadas a 375 px; nenhuma rola para o lado; abas, faixa "Próximo passo" e Comunicação ficaram mais enxutas (Melhorias).
- **Para você validar:** 5 decisões (Decisões tomadas por mim) e os itens novos de `pendencias.md` (antes da produção: `META_APP_SECRET`, `ASAAS_MASTER_WALLET_ID`, `NEXT_PUBLIC_APP_URL`).
- Commits da noite em `main` a partir de `8f92ec0`, sem push.

## Como rodou

- Mac: 16 GB. Memória conferida antes de cada bloco (`memory_pressure`); e2e sobre o build de produção (`E2E_SERVER=prod`), uma área por vez.
- Banco: Supabase local. Asaas: só o sandbox (o e2e roda sem chave). Nada de produção.

## Andamento

| Item | Estado | Commit | Resultado | Observações |
| --- | --- | --- | --- | --- |
| Preparação (Mac acordado, memória, banco) | feito | — | 16 GB, 77% livres; Supabase no ar; árvore limpa em `8f92ec0` | |
| Suítes rápidas e de banco | feito | — | core 302, Vitest 1279, banco 175: todos verdes | |
| e2e cobranças (7 specs) | feito | `373841c` | 46 passaram, 1 falhou (corrigido), 1 pulado de propósito | O pulado é o Pix Automático, que ainda não tem tabelas no banco (doc 15) |
| Guia na tela (pedido da noite) | feito | `e500395` | typecheck, lint, Vitest; e2e novo `guia-na-tela` verde nas duas rodadas completas | |
| e2e financeiro, relatórios e plano | feito | — | 43 passaram, 1 pulado de propósito | Pulado: troca para plano maior (`test.fixme` antigo); rotina e webhook do plano pulam sem `CRON_SECRET`/`ASAAS_WEBHOOK_SECRET` no `.env.local` |
| e2e resto do desktop (28 specs) | feito | vários | 286 passaram, 12 falharam; refeitas: 2 sobraram, 1 corrigida | Falhas por migração no meio da rodada (build antigo), testes desatualizados e 1 defeito (troca de aba). O `verificacao-email` (dispositivo lembrado) passou depois do ajuste do teste (`a991d5f`) |
| Revisão de valores (agente) | feito | `745b0d9`, `801b4ed`, `5328bcb`, `98ac662`, `c132061`, `065c685`, `48347ec` | 6 achados + suspeitas | Os 6 corrigidos, mais recibo, aula avulsa e 1ª mensalidade. Sobrou uma pergunta de produto (Decisões) |
| Auditoria de segurança (agente) | feito | `b4a62e0`, `cd7f630`, `10747ed`, `a759374`, `4ad3799`, `db5048d`, `144d9f1`, `4b54730`, `9b39923`, `7e2745b`, `aa13c8a` | 1 crítico, 5 altos, 9 médios, baixos | Todos os críticos, altos e médios feitos; dos baixos ficaram 3 (O que ficou de fora) |
| e2e completo, rodada 1 (computador e celular) | feito | — | 415 passaram, 2 pulados de propósito, 24 min | Build anterior aos 3 últimos commits de valores |
| Celular: 21 telas por captura a 375 px | feito | `8c0f31c` | Nenhuma rola para o lado; 4 ajustes (Melhorias, item 2) | Capturas antes e depois conferidas uma a uma |
| e2e completo, rodada 2 (tudo da noite) | feito | `85bb665` | 414 passaram, 1 falhou, 2 pulados | A falha era corrida do teste da landing (foco atrasado do formulário), não do app; corrigida e repetida 3 vezes |
| Suítes rápidas no fim | feito | — | core 303, Vitest 1311 | |

## Bugs corrigidos

1. **Comunicação: trocar de aba às vezes ficava na aba antiga** (`373841c`). A aba tinha ido para o endereço hoje (`?tab=`), e cada troca virou uma navegação ao servidor; dois toques seguidos disputavam e a tela ficava no Histórico. Agora a troca usa o `history.replaceState` do navegador (sem servidor): instantânea e sem disputa. Achado pelo e2e `dinheiro-cobrancas`.
2. **Guia na tela travava ao avançar sem clicar** (`e500395`, relatado por você). Detalhes em "Melhorias".
3. **Código Pix ou link antigo reativava cobrança cancelada e cobrava em dobro** (`745b0d9`). Troca de plano, desconto, bolsa, pausa, inativação e saída da aula avulsa cancelavam a cobrança, mas o Pix já enviado pelo WhatsApp seguia valendo (até 30 dias). Pago, o webhook marcava a cobrança cancelada como paga ao lado da substituta (cobrança em dobro), ou a baixa batia no índice do período e o dinheiro não entrava no Financeiro; pago em dinheiro virava Pix. Agora esses cancelamentos cancelam o código (banco e Asaas) e o webhook só dá baixa em cobrança em aberto; senão, a cobrança fica como estava e o dono recebe um aviso na Auditoria para devolver ou combinar o valor.
4. **Troca de botão de conectar o WhatsApp com jargão** (`d933eb5`): "Conectar via Popup da Meta" e "Conectar modo Sandbox (Ambiente local)" viraram um botão só, "Conectar WhatsApp oficial"; o de "Sandbox" aparecia para clientes.
5. **e2e mandava WhatsApp de verdade** (`a991d5f`): com as credenciais da Meta no `.env.local`, o envio oficial do e2e chamava a API real para números de teste. O servidor do e2e agora zera essas variáveis, como já fazia com Asaas e e-mail.
6. **Cobrança cancelada podia ser dada como paga** (`801b4ed`). Até a "Substituída" pelo sistema recebia baixa ao lado da substituta, e o "Desfazer" reabria qualquer cobrança sem as travas do "Reabrir". Agora a cancelada pede para reabrir antes, e o desfazer só vale para a paga.
7. **Aluno do "Mês cheio" de volta da pausa ou da inativação pagava duas mensalidades cheias em duas semanas** (`5328bcb`). Exemplo: início em 05/01, volta em 20/03: R$ 150 de 20/03 a 04/04 e outros R$ 150 de 05/04 a 04/05. No "Mês cheio" o dia do vencimento agora é sempre o dia do início (doc 15); um dia editado à mão também deixava dias sem cobrança.
8. **DRE e Financeiro não batiam** (`98ac662`). O DRE contava o pagamento do professor pelo mês trabalhado e os lançamentos pelo vencimento; o Financeiro, pela data do pagamento. Agora os dois usam a data do pagamento. E um pagamento às 23h30 num espaço de Manaus caía no mês seguinte: as contas usam o fuso do espaço.
9. **Recibo e declaração anual mostravam o valor da cobrança, não o pago** (`c132061`). Com a taxa do pagamento online repassada ao aluno, ele paga R$ 153,28 por uma cobrança de R$ 150,00. Agora mostram o que foi pago, e o recibo separa "Valor da cobrança" e "Taxa do pagamento online".
10. **Aluno avulso que pagou, saiu da aula e voltou era cobrado de novo** (`065c685`). Agora a volta usa a cobrança já paga.
11. **1ª mensalidade do cadastro confiava no navegador** (`48347ec`). Um período errado travava a geração das seguintes (regra da sobreposição). Agora o período é sempre um do motor, e o valor ajustado à mão só vale para quem tem a permissão de cobranças; o atendente que cadastra fica com o valor do motor.
12. **Convite não achava conta já existente com mais de 50 contas na plataforma** (`aa13c8a`): a busca lia só a primeira página.

## Melhorias feitas

1. **Guia na tela ("Me mostre na tela") para quem não é do ramo** (`e500395`). Passo que pede clique (botão, aba, menu, item) não tem mais "Próximo": a pessoa clica no destaque ou toca em **"Fazer por mim"**, que clica por ela, e o guia só segue com a tela pronta (janela aberta, menu aberto). Botão desligado avisa. Se o alvo some, o balão diz "Não achei isso na tela agora" e oferece "Voltar" e "Pular este passo". Escolhi não trocar por biblioteca (driver.js, Shepherd, Joyride): elas têm o mesmo problema de sincronizar com a janela que abre e exigiriam a mesma lógica; o guia atual já acha os alvos pelo texto da tela. e2e novo: `guia-na-tela`.

2. **Celular (375 px), 21 telas revisadas por captura** (pedido da noite). Nenhuma tela rola para o lado. O que mudou:
   - **Abas** (Financeiro, Comunicação, Configurações, Planos): eram quatro cópias; viraram um componente só, `PageTabs`. No celular ocupam a largura toda, em partes iguais e sem ícone: as de três abas cabem numa linha (antes quebravam em duas, com uma aba sozinha embaixo).
   - **Faixa "Próximo passo"** no topo de toda tela: o botão "Fazer agora" espremia o título em três linhas. No celular fica só a seta; a faixa cai de uns 130 px para 65 px.
   - **"Descubra o dia a dia"** no Painel: só a seta no celular, e o item inteiro abre o passo (antes o alvo do toque era o texto pequeno).
   - **Comunicação**: os dois números do mês lado a lado e sem o respiro em dobro (cada cartão tinha uns 170 px de altura); os modelos de mensagem com os ícones ao lado do nome, não numa linha própria.
   - Revisadas e sem ajuste: Alunos, ficha (Plano e Cadastro), Turmas, turma, Calendário, Cobranças, Relatórios, Usuários, Auditoria, Modalidades, Equipe e Planos do GestaraHub.

## Decisões tomadas por mim, para validar

1. **DRE pelo dia do pagamento** (`98ac662`, doc `product/05`, D10 e D11). O DRE passou a ser regime de caixa, igual ao resumo do Financeiro: o pagamento do professor de setembro pago em 05/10 entra em outubro. Se preferir competência (o mês trabalhado), o certo é mudar os dois juntos, não só o DRE.
2. **Valor da 1ª mensalidade ajustado só por quem tem a permissão de cobranças** (`48347ec`). O atendente que cadastra vê o valor do motor; o dono e o gerente seguem ajustando.
3. **Cobrança atrasada desde um início antigo (pergunta aberta, não mexi).** Cadastrar um aluno com início meses atrás gera a 1ª mensalidade do início, e a geração em lote cria as dos meses seguintes até hoje. É o certo para quem esqueceu de cadastrar, mas assusta quem só quer registrar a data de entrada. Opção: perguntar no cadastro "Cobrar os meses desde o início?" quando o início for de mais de um mês atrás.
4. **Pix e link sem repasse quando falta `ASAAS_MASTER_WALLET_ID`.** Sem a carteira da conta principal, o Asaas não separa a taxa do GestaraHub, mas o app ainda soma essa taxa ao valor repassado ao aluno (R$ 1,99 ou R$ 1,29 a mais, que ficam com o espaço) e mostra o líquido menor. Deixei como está: é configuração obrigatória em produção (está na lista de antes da produção), e zerar a taxa no código mudaria os valores da demonstração e do e2e.
5. **Sem cabeçalho CSP por enquanto.** Ele protege contra script injetado, mas precisa listar PostHog, Asaas, Meta e Supabase e quebra fácil; melhor junto do roteiro de publicação, testado no build de produção.

### Validação do usuário (31/10/2026, de manhã)

1. **DRE pelo dia do pagamento:** confirmado (`technical/05`, D10).
2. **1ª mensalidade ajustada só por dono e gerente:** confirmado.
3. **Início antigo:** perguntar no cadastro. Feito em `0d9d5fc`: "Cobrar os meses desde o início?", padrão "A partir deste mês" (`clients.charges_from`, `product/15`, "Aluno antigo: meses passados").
4. **Sem a carteira principal:** resolver agora. Feito em `b2b4c13`: a taxa do GestaraHub fica zero quando o Asaas não pode retê-la (`technical/25`, Regras).
5. **CSP:** resolver agora. Feito em `736b4c2`: lista de origens, script inline ainda liberado (`technical/00`, "Cabeçalhos de segurança e CSP"). A área logada ainda não passou pelo e2e com o CSP.

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
| M6 | média | Link público de autorização do menor sem limite, e regravava até a autorização já dada em papel | 10 envios por IP por hora, tamanho máximo, autorização registrada não muda | `9b39923` |
| M7 | média | Fatura pública criava e cancelava pagamentos no parceiro sem limite (podia cancelar o Pix que o aluno pagava) | 6 por IP e cobrança a cada 10 minutos, 15 por cobrança por hora | `9b39923` |
| M8 | média | Webhook do WhatsApp sem conferir a assinatura da Meta: qualquer um mudava a situação das mensagens | Assinatura com `META_APP_SECRET`; produção recusa sem ele | `144d9f1` |
| M9 | média | A análise de uso (PostHog) guardava tokens de senha e convite, e-mail e o id dos links públicos | Endereço limpo antes de sair do navegador | `4b54730` |
| Baixos | baixa | Busca de e-mail com curinga (`%`), planilha que roda fórmula, segredos comparados com `!==`, cookie sem `httpOnly`/`secure` | Busca exata, célula protegida, comparação em tempo constante, cookie fechado | `7e2745b`, `144d9f1`, `10747ed` |

**Para você fazer:** se alguma chave real de subconta do Asaas já existiu num banco com essa falha, troque a chave no Asaas (a exposição era para membros do próprio espaço). Ao publicar, as sessões abertas caem uma vez (cookie novo, assinado): todos entram de novo.

## O que ficou de fora

- **Painel interno (`apps/admin`)**: fora, como pedido.
- **Pix Automático**: o e2e segue pulado; ainda não tem tabelas no banco (doc 15).
- **Taxas do pagamento online no DRE**: a linha "Deduções" é sempre zero (`financialReports.ts`), embora cada Pix e link já guarde a tarifa e o líquido. Falta decidir como contar quando a taxa é repassada ao aluno. Está em `pendencias.md`, Esperando decisão sua.
- **Segurança, baixos sem correção**: o endereço dos e-mails de senha, convite e consentimento cai para o endereço da requisição quando falta `NEXT_PUBLIC_APP_URL` (pus a variável na lista de antes da produção); e uma regra do armazenamento aceita o espaço `system`, que nenhum usuário tem (sem efeito hoje).

