# Revisão geral do web (31/10/2026)

Pedido do usuário: rodar os testes completos do web (e2e e de tela, sem o painel admin), revalidar o que foi feito procurando brechas de segurança e bugs, validar o Supabase e os cálculos de valores das server actions, corrigir o que achar, organizar o código onde valer a pena e documentar por categoria. Branch `main`, commits pequenos, sem push.

**Como foi feito:**
- Três agentes leram o código em paralelo, só leitura:
  - segurança e banco, com consultas de leitura no banco local;
  - valores e cálculos, com scripts de prova contra o core;
  - organização do código.
- Cada achado foi conferido no código antes da correção.
- Toda correção ganhou teste: core, Vitest, banco ou e2e.
- O e2e completo rodou no build de produção antes e depois das correções.

## Resumo

- **Segurança:** 2 falhas altas corrigidas.
  - O cookie de sessão era assinado com o que o navegador mandava: um professor montava a sessão do dono.
  - As escritas da evolução devolviam o cadastro inteiro do aluno, com CPF, ao professor.
  - Também corrigidos 13 itens médios e baixos: escrita direta no banco em 22 tabelas, cancelamento no Asaas que falhava para o atendente, leituras sem o escopo do professor, anexo que rodava script, aceite de termos forjável e outros.
- **Valores:** 2 defeitos altos corrigidos.
  - Troca de plano de aluno antigo gravava valor e datas errados.
  - Voltar da pausa pulava um ciclo inteiro sem cobrança.
  - Também corrigidos 10 médios e baixos: média 5,95 que reprovava, troca de escala com notas lançadas virando 10 de 10, atendente dando bolsa e mudando o preço do curso, arredondamentos de meio centavo e outros.
- **Refatoração:**
  - código morto removido;
  - um validador de data só;
  - componente de abas em pílula compartilhado;
  - leitor de número decimal único;
  - `.gitignore` que escondia código-fonte.
- **Usabilidade:** 3 ajustes nas telas novas, achados nas capturas do celular e do computador.
- **Banco:** migrações 76 (escrita só pelo servidor e leitura direta mais estreita), 77 (higiene) e 78 (as sete tabelas que a 76 deixou de fora).
- **Decisões:** as 5 foram validadas pelo dono no mesmo dia; a 5 virou a migração 78 (seção "Decisões tomadas por mim").

## Testes

| Rodada | Resultado | Observações |
| --- | --- | --- |
| e2e completo, rodada 1 (build de produção, antes das correções) | 428 passaram, 1 falhou, 2 pulados de propósito | A falha era corrida do próprio teste do certificado (`68941ea`), repetida 5 vezes sem falha |
| Testes de banco | 195 de 196; a falha virou correção | Duas chamadas no primeiro uso de um serviço quebravam (`fe392dd`) |
| Suítes rápidas no fim | typecheck e lint sem erro; Vitest 1356 de 1356; core 326 de 326; banco 196 de 196 | |
| Teste de tela (celular e computador) | 20 telas, nenhuma com rolagem lateral | 3 ajustes, na seção Melhorias de usabilidade |
| e2e completo, rodada 2 (build de produção, depois das correções) | 429 passaram, 2 pulados de propósito, nenhuma falha | Celular e computador, 25,6 min |
| Depois das decisões (S14, S15) | typecheck e lint sem erro; Vitest 1356 de 1356; banco 206 de 206 | 10 testes de banco novos; e2e não rodou de novo |

## Correções de segurança

| # | Gravidade | O que era | Como ficou | Commit |
| --- | --- | --- | --- | --- |
| S1 | alta | `refreshSession`, `signIn` e `switchUser` assinavam o cookie com o `UserView` que o navegador mandasse: um professor montava a sessão do dono e gravava aceite de termos no nome dele | `signIn` e `switchUser` (sobras do protótipo) saíram; `refreshSession` monta as claims pelo banco para o usuário da sessão atual; na demonstração só aceita o mesmo usuário; a sessão usa o perfil do banco | `2ed7a3b` |
| S2 | alta | Pela aula, o professor registrava evolução em qualquer aluno, e as escritas da evolução devolviam o cadastro inteiro (CPF, endereço, desconto) | O caminho da aula exige aluno daquela turma e modalidade; as escritas devolvem o aluno sem dinheiro e documentos ao professor | `432da38` |
| S3 | média-alta | O usuário logado escrevia direto pelo PostgREST em tabelas que o app só grava pelo servidor (notas de qualquer turma, `charges_from` e graduação do aluno, cobranças, financeiro), pulando validação e auditoria | Migração 76: sem INSERT, UPDATE e DELETE para `anon` e `authenticated` em 15 tabelas; a única escrita em `clients` pelo cliente do usuário passou para o servidor | `38f38ce` |
| S4 | média | Leituras sem o escopo do professor: boletim, avaliações da turma, lançamento, faltas seguidas (com `minStreak` 0 voltavam todos os alunos com telefone), matrículas, espera, graduação, certificado | Professor só nos alunos e turmas dele (titular ou substituto); `minStreak` no mínimo 1 | `100437a`, `b379425`, `432da38` |
| S5 | média | O anexo saía com o tipo gravado na linha: um HTML virava script na origem do app; a linha podia apontar outro caminho do armazenamento | Abre no navegador só imagem e PDF; o resto desce como arquivo; o arquivo precisa estar na pasta do espaço (também na logo dos documentos) | `752633f` |
| S6 | média | Leitura direta no banco era do espaço inteiro: professor lia notas e testes e medidas de todos; consentimentos (IP, navegador, responsável) abertos a todos | Migração 76: notas e medidas só dono, gerente e atendente pelo banco (as telas leem pelo servidor, com o escopo); consentimentos só dono e gerente | `38f38ce` |
| S7 | baixa-média | `cancelGatewayPaymentsAction` sem permissão de cobrança | Exigia `billing:manage`; trocado pela S14, que só repassa o que o banco já cancelou | `53ed108`, `e447bbe` |
| S8 | baixa | O aceite de termos aceitava do navegador o tipo, a versão, o hash e metadados que sobrescreviam e-mail e perfil | Só os termos da plataforma na versão em vigor; hash no servidor; dados da prova vindos da sessão | `30566e1` |
| S9 | baixa | Recibos usavam o `organizationId` do pedido para expirar códigos de outro espaço | Espaço da sessão | `53ed108` |
| S10 | baixa | `serviceAction` resolvia o método antes do login e andava por `__proto__` (enchia o registro de erros) | Sessão primeiro; só `namespace.metodo` próprios do registro | `cf08841` |
| S11 | baixa | Login limitado só por IP e e-mail | Também 20 tentativas por conta a cada 15 minutos, de qualquer endereço | `3ae3f36` |
| S12 | baixa | O comentário do CSP prometia bloquear o envio de dados para fora | Comentário honesto: com script inline, uma imagem ainda leva dado para fora; fechar pede nonce | `577b549` |
| S13 | baixa | Regra `system` no armazenamento; duas funções `SECURITY DEFINER` sem `search_path`; preferências com qualquer chave e tamanho | Migração 77; preferências só com as chaves conhecidas, até 64 KB | `577b549` |
| S14 | média | Efeito da S7: o cancelamento no Asaas roda depois da gravação com quem fez a ação. O atendente que inativava aluno ou cancelava matrícula deixava o Pix ou o link valendo no Asaas, com o app mostrando cancelado | Sem a permissão de cobranças; só repassa ao Asaas o código que o banco já marcou como cancelado (chamada de fora não cancela código em aberto) | `e447bbe` |
| S15 | baixa-média | Categorias, cargos, equipe, planos, pacotes, anexos e pagamentos online aceitavam escrita direta de dono e gerente (anexos também atendente), pulando validação e auditoria; as ações antigas de pagamento online recebiam do navegador o espaço, a situação e o aluno | Migração 78; as ações gravam pelo servidor com a permissão e o espaço da sessão; código novo sempre em aberto, numa cobrança do espaço e com o aluno dela; o envio de anexo confere o perfil na sessão | `e447bbe`, `2cfb6a8` |

## Correções de valores e cálculos

| # | Gravidade | O que era | Como ficou | Commit |
| --- | --- | --- | --- | --- |
| V1 | alta | Trocar o plano de aluno cadastrado "a partir deste mês" mostrava o 1º período desde a entrada antiga e o dono gravava R$ 73,33 no lugar de R$ 200,00 | A prévia usa o `chargesFrom` do aluno; se o motor troca o período, vale o valor dele | `ea66893`, `f160456` |
| V2 | alta | Voltar da pausa dentro de um período já cobrado recomeçava hoje e pulava o ciclo inteiro (até um mês sem cobrança) | Recomeça no dia seguinte ao fim do último período cobrado que ainda cobre hoje | `344a975` |
| V3 | média | A 1ª mensalidade aceitava do navegador o fim do período, o vencimento e o proporcional (um fim forjado travava todas as seguintes) | Período, fim e proporcional sempre do motor; do formulário só o valor (com a permissão) e um vencimento válido | `ea66893` |
| V4 | média | Média 5,95 arredondava para 5,9 e reprovava | Arredondamento limpo em 12 dígitos | `e494315` |
| V5 | média | Trocar a modalidade para soma dos pontos com notas lançadas virava 10 de 10 (e a volta lia pontos como média) | Com nota lançada, escala e forma de fechar não mudam; pontos nunca abaixo de uma nota lançada | `66a6b64` |
| V6 | média-baixa | A prévia do cadastro ignorava a validade do desconto (e o dono gravava o valor errado) | O motor recebe o preço cheio e o desconto com a validade | `f160456` |
| V7 | baixa-média | Repassar a taxa com tarifa percentual com teto cobrava a mais do aluno (R$ 6,99 em R$ 1.000) | Busca binária do menor valor que cobre tudo | `e494315` |
| V8 | baixa | Repasse do professor com percentual decimal perdia um centavo | Conta em centésimos inteiros | `e494315` |
| V9 | baixa | Proporcional e desconto percentual decimal arredondavam meio centavo para baixo | Conta inteira | `e494315` |
| V10 | média | Atendente (sem permissão de cobranças) matriculava em curso de R$ 800 por R$ 0,01 e dava bolsa de 100% | Sem a permissão, o curso fica com o preço da turma e desconto ou bolsa é recusado com mensagem | `80cff45` |
| V11 | média-baixa | A fatura pública mostrava o valor da regra padrão, diferente do Pix já gerado | Mostra o valor do próprio código | `6355e0d` |
| V12 | baixa | `chargesFrom` aceitava qualquer data até hoje (pulava a mensalidade deste mês já vencida) | Só o dia 1º do mês atual | `ea66893` |
| V13 | baixa | O extrato anual separava o ano em UTC (pago em 31/12 depois das 21h ia para o ano seguinte) | Ano no fuso do espaço | `c1d4dd2` |
| V14 | baixa | Preço do plano aceitava fração de centavo | Só centavos inteiros | `84dab16` |

### Outras correções (fora das auditorias)

- `63440ef` Avaliação sem pontos na soma avisa "Defina quanto vale".
- `32e29de` Notas e medidas aceitavam data que não existe (2026-02-31): um validador só, `isIsoDate`.
- `fe392dd` Duas chamadas simultâneas no primeiro uso de um serviço quebravam (import ainda carregando).
- `68941ea` Corrida do teste e2e do certificado.

## Melhorias de usabilidade (teste de tela)

As telas novas do dia foram capturadas no celular (375 px) e no computador (1280 px), no build de produção:
- modalidade com notas e testes e medidas;
- aba Avaliações da turma;
- nova avaliação e lançamento da recuperação;
- boletim e testes e medidas do aluno;
- ficha na Evolução;
- cadastro de aluno com início antigo.

Nenhuma das 20 telas tem rolagem lateral. O que melhorou:

| O que era | Como ficou | Commit |
| --- | --- | --- |
| No celular, as medidas da modalidade quebravam em duas linhas soltas: não dava para saber de qual medida era cada "Melhor descer" | Cada medida num bloco no celular; no computador, colunas alinhadas (o botão "Melhor subir" é mais estreito e desalinhava o nome) | `40e4c58` |
| No boletim, a prova recuperada seguia com a linha vermelha, e "Vale 3,5 pela recuperação" se confundia com "Vale 4" (quanto a prova vale) | "Ficou 3,5 com a recuperação"; a linha só fica vermelha se a nota que vale ainda estiver abaixo da mínima | `fe36daa` |
| Na aba Avaliações, o valor de "Total da turma" caía sozinho na linha de baixo | Rótulo e valor juntos | `fe36daa` |

Conferido e sem defeito: o foco no "Nome" da nova avaliação que apareceu numa captura foi do emulador do celular (no primeiro teste, o Chrome emulado respondeu que a tela não era de toque). O teste `ficha-notas.mobile.spec.ts` já confere que o campo não ganha foco no toque.

## Refatoração

- `3fe17fd` `.gitignore`: a regra `certificates` sem âncora escondia `src/**/certificates`, e arquivo novo ali não entrava no commit.
- `49aa5dd` Código morto removido:
  - 15 aliases `*Drawer`;
  - `features/system` (o cartão antigo de apagar a demonstração);
  - `coming-soon` e `list-card`;
  - `cancelReserva`;
  - 9 exports sem uso;
  - o campo `vagasRestantes`, que nunca era lido.
- `32e29de` `isIsoDate` no core no lugar de quatro validadores de data.
- `c60bc6d`:
  - `PillTabs` compartilhado (três cópias nas Notas, Testes e medidas e Graduação);
  - `parseDecimal` no core (três cópias);
  - `measurementsServiceImpl` nomeado na origem.
- Guardas do professor num lugar só (`assertTeacherSeesStudent`, `assertTeacherSeesClass`, `teacherSeesClassRoster` em `teacherScope.ts`) no lugar das checagens escritas à mão.

## Decisões tomadas por mim (validadas pelo dono em 31/10/2026)

1. **Desconto e bolsa só com a permissão de cobranças** (`80cff45`). Mantida. O atendente que tenta recebe "Desconto e bolsa só com a permissão de cobranças." e o curso fica com o preço da turma. É a mesma regra da 1ª mensalidade.
2. **Modalidade com notas lançadas não troca de escala nem de forma de fechar o resultado** (`66a6b64`). Mantida. Para trocar, crie outra modalidade.
3. **Volta da pausa recomeça depois do período já cobrado** (`344a975`). Mantida. Quem pagou de 15/10 a 14/11 e volta em 14/11 tem a próxima cobrança em 15/11; os dias pausados dentro do período pago não viram crédito.
4. **Professor não lê notas nem testes e medidas pelo banco direto** (migração 76). Mantida. As telas leem pelo servidor, com o escopo dele.
5. **Sete tabelas com escrita pelo cliente do usuário** (categorias, cargos, equipe, planos, pacotes, anexos e pagamentos online). O dono pediu para fazer já: migração 78 (S15). Ao conferir, apareceu a S14.

## O que ficou para depois

Está em `docs/pendencias.md`.

**Segurança:**
- Leitura direta de presenças, matrículas, reservas, espera e equipe ainda é do espaço inteiro.
- Registro com permissão obrigatória em todo método (negar por padrão).
- Reconferir no Asaas o pagamento do webhook antes da baixa.
- `organizations.settings` (chave Pix) legível por todos do espaço.
- A página `/p/<código>` grava `opened_at`.

**Valores:**
- DRE sem as taxas do pagamento online (decisão sua, já em pendências).
- O texto "R$ 1,99" das configurações quando falta a carteira principal.
- O fim de período na soma dos pontos não fica vermelho quando os pontos dados não somaram o total.

**Organização (relatório do agente):**
- datas formatadas em vários lugares (`dd/MM` com 16 cópias);
- `clone` com 18 cópias;
- `forbiddenError` escrito à mão;
- um `FormDrawer` comum;
- `queryKeys` escritos à mão;
- páginas importando o interior das features;
- `client-form.tsx` com 2 mil linhas;
- placeholders "Ex.:" e um `line-clamp`.
