# Diário da execução noturna de 10 para 11/11/2026

Pedido (10/11/2026, à noite): criar os testes que faltavam, testar a aplicação inteira (telas no computador e no celular, e2e, desempenho, picos de uso simulando Vercel e Supabase), apontar melhorias de arquitetura e de consumo de dados (leve e rápido em internet lenta), cuidar da memória do Mac, corrigir o que achar e fazer pendências que não dependem de decisão. Nada commitado: tudo fica na árvore para a validação da manhã.

## Resumo para a manhã

- **Internet lenta:** cada tela do app no celular, em "Slow 4G", caiu de 3,8 s para 2,0 s em média. A causa era uma fila de ~18 leituras por tela (o Next roda as server actions de uma aba uma por vez). As leituras agora vão por uma rota própria, em paralelo.
- **Pacote menor:** primeira visita ao app de 1.045 para ~610 KB (gzip, −42%); landing de 556 para 352 KB; o link de pagamento que o aluno abre pelo WhatsApp de 402 para 238 KB.
- **Pico de uso:** um processo do servidor aguentou 50 usuários simultâneos sem erro (p95 de 0,84 s) e com memória estável; o gargalo é o banco. Com 100, o login local saturou e o app deslogava a pessoa: corrigido.
- **Defeitos de tela:** o Financeiro no celular afastava o zoom da página inteira; a semana do Calendário cortava o domingo em notebook de 1280 px; a frase "Entra como pelo pacote ou experimental" na aula sem avulso. Corrigidos.
- **Testes:** e2e novos de Eventos e de Recebimentos online; 31 e2e de dinheiro atualizados às telas novas; testes de unidade e de serviço novos (recortes, lembretes, visitantes, conferência de pagamento, erros do login). e2e completo no build final (computador e celular): 442 passaram, 1 falhou (guia na tela, abaixo), 2 pulados de propósito.
- **Pendência feita:** selo "Visitante" em Alunos (doc 29).
- **Para você decidir:** a retirada do `loading.tsx` (a barra no topo continua) e a seta de rolar das janelas por cima do texto corrido (Termos).

## Como rodou

- Mac de 16 GB; memória livre entre 72% e 80% a noite toda (`memory_pressure` antes de cada bloco). Um build e um navegador por vez. Mac mantido acordado com `caffeinate` (10 h).
- Servidores de produção locais (`next start`): 3100 para o e2e (relógio fixo), 3200 e 3300 com a demonstração para as telas e a carga. Banco: Supabase local. Asaas, e-mail, WhatsApp e PostHog desligados.

## Bugs corrigidos

1. **Financeiro no celular afastava o zoom da página inteira.** A tabela escondida para leitor de tela do gráfico de fluxo de caixa tinha `sr-only` direto na `<table>`: tabela ignora a largura de 1 px, esticou até 425 px e o celular encolheu a página. O `sr-only` foi para um `<div>` em volta, e um teste de fonte impede `sr-only` direto em tabela.
2. **Semana do Calendário no notebook (1280 px) mostrava o domingo cortado e "Deslize para ver os outros dias".** O dia sem aula fica estreito de propósito (10/11), mas o nome "DOMINGO" vazava da coluna e a grade achava que tinha rolagem. Dia estreito agora mostra "DOM", a célula não deixa vazar, e no computador largo a dica não aparece.
3. **Pico de acessos deslogava a pessoa.** Falha passageira do serviço de login virava "Sua sessão expirou". Agora pede para tentar de novo; só sessão inválida desloga.
4. **"Entra como pelo pacote ou experimental."** na aula de turma sem avulso (e o aviso "turma sem avulso" tinha sumido). Agora: "Entra como pacote ou experimental. Turma sem aula avulsa."
5. **Erros do React ao abrir uma tela pelo endereço (#418 e #310), por causa do `loading.tsx` de 09/11.** A fronteira de streaming dele faz a página hidratar depois do layout. Com as leituras em paralelo, os dados que o layout já buscou chegam antes, e a página renderiza diferente do HTML do servidor (#418: a tela inteira é refeita no navegador, visto em Comunicação). E o `redirect()` das guardas, dentro do streaming, quebrava o roteador do Next 16 (#310: abrir pelo endereço uma tela de outro modelo ou sem permissão). Troquei o `loading.tsx` por uma barra disparada pelo clique nos links: a mesma barra fina no topo, depois de 250 ms (doc 07 §1.9). A guarda de modelo e permissão também roda no layout, antes da página, com redirecionamento HTTP.
6. **Erros falsos no console a cada gravação:** `POST /api/preferences` respondia 401 na barbearia de demonstração (sessão sem banco) e `DELETE /api/attachments/<id>` respondia 409 quando o arquivo já estava em uso (a limpeza pede isso de propósito). As duas respostas agora são 200 dizendo que não removeu ou não salvou; o app não lia o status.
7. **Guia na tela: Esc numa janela aberta pelo guia fechava o guia junto** (painel de 11/11). O guia agora ouve o Esc antes da janela e só fecha sem janela aberta. Ainda falta: com a janela fechada no meio, o guia fica no passo 2 com "Não achei isso na tela agora. Volte um passo ou pule este." em vez de voltar sozinho ao passo 1 (o e2e `guia-na-tela` "fechar a janela no meio" segue falhando de propósito).
8. **Plano pago aparecia como "Grátis" em Configurações → Plano** (corrida). No navegador, a assinatura é lida do espaço em memória, que só se preenche quando a organização chega do servidor. Com as leituras mais rápidas, a assinatura às vezes era lida antes. Agora a leitura espera a organização (achado pelo e2e `plano-gestarahub`).
9. **Nome acessível do seletor de mês e das linhas da chamada** saía com espaços a mais no Chrome novo ("Escolher mês ( Setembro de 2026 )", "Ana : sem marcação"). Os dois ganharam nome explícito; isso também derrubava uns 30 e2e.

## Melhorias de desempenho e banda

Detalhes e números na doc `technical/19-desempenho-e-escala.md`, seção 14.

1. **Leituras em paralelo** (`/api/svc`, `services/world/serviceRunner.ts`): mesma sessão, permissão, recorte e repetição da server action; checa a origem. Gravações seguem pela action, na ordem.
2. **Pacote:** PostHog só depois do aceite de cookies; Zod só o núcleo na configuração; Ajuda e Fale com a gente sob demanda; layout sem importar os "barris" das features; `sideEffects` no `package.json` do web (antes, toda tela levava o app inteiro). Arquivo novo que faz algo ao carregar precisa entrar na lista do `sideEffects` (doc 19 §14).
3. **Menos leitura em toda tela:** recortes novos (organização, unidade, configuração inicial, conexão do WhatsApp, contestações, presenças do dia); o sino deixou de baixar a lista inteira de alunos só para contar troca de nível pela idade; a configuração inicial pronta não relê a contagem; lembretes relidos no máximo uma vez por minuto fora do Painel; aviso de mudança de horário só carrega o WhatsApp quando pedido.
4. **Conferência de pagamento** (Pix público, assinatura, troca de plano): pausa com a aba escondida, espaça de 3,5 s para 10 s e 30 s e para em 20 min. Antes, ~1.000 pedidos por hora numa aba esquecida, cada um consultando o Asaas.
5. **Servidor:** repetição em conflito com espera aleatória; cache do espaço com teto de 150 mil linhas (antes 400 mil, mais de 300 MB por instância), ajustável por `WORLD_CACHE_MAX_ROWS`; um cliente administrativo do Supabase por processo; região da Vercel em `gru1` (`apps/web/vercel.json`).

## Passada de telas

40 telas (20 no computador a 1280 px no tema claro, 20 no celular a 390 px no tema escuro), na demonstração, medindo erro no console, rolagem lateral, reticências e campo com menos de 16 px no celular. Depois das correções: nenhum problema nas medições. Olhando as capturas: além dos itens corrigidos, ficou a seta de rolar das janelas por cima do texto dos Termos (decisão sua, abaixo).

## Testes

| Suíte | Resultado |
| --- | --- |
| e2e completo (computador e celular), build de produção final | 442 passaram, 1 falhou, 2 pulados de propósito (24 min) |
| Vitest do web | 1.453 passaram (eram 1.437) |
| Core | 360 passaram |
| Admin | 74 passaram |
| Banco (motor, servidor, anexos) | 116 passaram |
| Tipos e lint (web e admin) | limpos |

- **A que falha:** `guia-na-tela` "fechar a janela no meio volta ao passo que a abriu" (item 7 dos bugs).
- **Novos:** e2e `eventos.spec.ts` (criar, inscrever três com duas vagas, espera e promover, valor por dia, zero com confirmação) e `recebimentos-antes-de-ativar.spec.ts`; Vitest dos recortes novos, troca de nível nos lembretes, visitantes, caminho das leituras, conferência de pagamento, erros do login e tabela escondida.
- **Atualizados às telas novas** (dois agentes, sem mexer no app): uns 25 specs, com ajudantes novos em `e2e/fixtures.ts` (`rowMenuAction` para o submenu "Acompanhamento", `expectOverdueRow`, `statusTab`, `statCard`, `monthPicker`).
- **Achados pelos agentes e confirmados como mudança de propósito:** o "Enviar boas-vindas" do cadastro começa desligado (04/11); os avisos do plano abrem primeiro a janela de urgência (09/11); o catálogo tem 10 relatórios (4 Pro); "Eventos" aparece no menu de todos os perfis.

## Decisões para você

0. **`loading.tsx` retirado** (o que você pediu em 09/11): a barra no topo continua igual, mas a troca não vai mais na hora para a tela vazia; a tela atual fica até a próxima chegar. Motivo: causava os erros #418 e #310 acima. Se a espera sem troca imediata incomodar no 3G, a saída é uma casca própria por tela, sem Suspense em volta da página.
1. **`sideEffects` ligado** no `package.json` do web: o erro de hidratação do primeiro teste era do `loading.tsx`. Sem ele, três rodadas de hidratação e a passada de telas ficaram limpas. Validado também no e2e completo (abaixo).
2. **Seta de rolar das janelas** (pílula no meio, embaixo) fica por cima do texto corrido dos Termos no celular. É o padrão de todas as janelas (#32). Opções: deixar; esconder só nos Termos; ou mover a pílula para o canto. **Decidido em 12/11/2026: fica como está.**
3. **Modelo do WhatsApp:** a gaveta do modelo mostra "Modelo oficial homologado pelo WhatsApp" mesmo sem a API oficial ligada (achado do agente do e2e). Vale um olhar de produto. **Feito em 12/11/2026:** o selo ("Modelo aprovado pelo WhatsApp") só aparece com a API oficial ligada e o modelo aprovado pela Meta.

## O que ficou de fora

- **Lista de alunos inteira nos seletores** (matrícula, cobrança avulsa, chamada, aniversários): cada um baixa o cadastro completo (CPF, endereço, histórico). Um `listOptions` enxuto economiza banda e dado pessoal; mexe em vários fluxos, deixei para o dia.
- **Lembretes:** `getReminderSources` é a leitura mais pesada (35 KB) e vem em toda tela pelo sino. Próximo alvo: o sino receber só a contagem.
- **Duas idas ao Auth por chamada** (`getUser` e a linha do usuário): dá para fazer em paralelo; mexe na segurança, deixei.
- **Barbearia (modelo de agenda)** não foi testada, como combinado.
