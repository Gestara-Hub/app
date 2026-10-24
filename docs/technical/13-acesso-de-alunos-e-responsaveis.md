# ADR 13 — Acesso de alunos e responsáveis à Área do Aluno

Data: 2026-10-21.

> **Status:** Decidido em 21/10/2026. Ainda não implementado: vale para a construção do PWA do aluno ([ADR 10](10-monolito-frontend-pwa.md)) e para a seção "Acesso" da ficha do aluno.

## Decisao

1. **A ficha do aluno não dá acesso. Acesso é um vínculo à parte.** Quem entra na Área do Aluno é uma conta global do Supabase Auth ([ADR 11](11-identidade-global-e-multi-membership.md)) ligada a uma ficha por uma linha de `student_access`:

   | Campo | Uso |
   |---|---|
   | `organization_id`, `client_id` | o espaço e a ficha do aluno |
   | `email` | para quem foi o convite |
   | `auth_user_id` | preenchido quando a pessoa aceita e entra |
   | `role` | `self` (o próprio aluno) ou `guardian` (responsável) |
   | `status` | `invited`, `active`, `revoked` |
   | `invited_by`, `invited_at`, `accepted_at`, `revoked_by`, `revoked_at` | rastro para a auditoria |

   Uma pessoa pode ter vários vínculos: um pai com dois filhos tem uma conta e duas linhas `guardian`; o mesmo pai pode ser `self` numa escola de idiomas em outro espaço. `public.users` continua sendo só da equipe (dono, gerente, atendente, professor): aluno e responsável nunca entram ali.

2. **Um login por pessoa, com dois seletores.** No login, quem tem vínculo em mais de um espaço escolhe o espaço primeiro (como já previsto no ADR 11). Dentro do espaço, quem tem mais de um vínculo (dois filhos, ou o próprio treino mais o filho) escolhe o perfil ("Ver como: Pedro, Lucas, Eu"). Os dois podem ser trocados por dentro do app, no cabeçalho: espaço e perfil ficam lado a lado, no mesmo lugar em que o gestor troca de espaço. A escolha fica salva no aparelho; a próxima abertura volta onde parou.

3. **E-mail da ficha e do responsável são contato, não login.** O e-mail em `clients.email` e em `guardians[].email` segue sendo texto de contato. Ele só serve para sugerir o destinatário do convite. Ninguém passa a ver dados de um aluno por ter o e-mail digitado na ficha; passa a ver depois de aceitar o convite daquele e-mail. Isso evita que um e-mail errado na ficha entregue os dados de uma criança a outra pessoa.

4. **A idade decide quem pode receber acesso; o espaço decide se envia.**

   | Idade do aluno | Responsável (`guardian`) | Próprio aluno (`self`) |
   |---|---|---|
   | até 12 anos | sim | não (o botão não aparece) |
   | 13 a 17 anos | sim | sim, com responsável ciente: só depois de um responsável com vínculo ativo, ou junto do consentimento de menor que já existe (`minorConsentStatus`) |
   | 18 anos ou mais | sim, enquanto não for revogado | sim |

   Aos 18 anos nada é revogado sozinho: os vínculos `guardian` continuam até alguém revogar. O que muda é que o aluno passa a poder revogá-los.

5. **O que cada papel vê.**

   | Área | `guardian` | `self` menor | `self` adulto |
   |---|---|---|---|
   | chamada, evolução, avisos, grade | sim | sim | sim |
   | cobranças e pagamento | sim | só "em dia" ou "em aberto", sem valores nem pagamento | sim |
   | dados cadastrais e termos | edita e assina | só vê | edita e assina |

   O detalhe por tela fica no [doc 23](../product/23-area-do-aluno-e-professor.md).

6. **Revogação dos dois lados, sempre auditada.** O espaço (dono, gerente ou atendente) revoga qualquer vínculo pela ficha. O aluno adulto revoga os próprios responsáveis pela Área do Aluno. Toda concessão e revogação entra em `audit_logs` com `security: true`, como os demais eventos de acesso.

7. **Fluxo na ficha do aluno.** Uma seção "Acesso", ao lado de Cadastro: lista quem tem acesso e o estado ("Carlos Mendes (pai) · ativo", "Pedro (aluno) · convite enviado"), com "Convidar responsável" (sugere os responsáveis cadastrados que têm e-mail) e "Liberar acesso ao aluno" (só quando a idade permite). O convite reaproveita o mecanismo de `organization_invitations` (token com validade, `accept-invite`), que passa a aceitar vínculos de aluno além dos perfis da equipe. Sem e-mail, o link sai pelo envio assistido do WhatsApp. Quem já tem conta não cria nada: o novo perfil aparece no seletor.

## Contexto

Nos espaços de ensino é comum o responsável acompanhar mais de um filho, e é comum o adolescente ter e-mail e celular próprios. O cadastro atual guarda os responsáveis como texto livre dentro da ficha (`guardians` jsonb); o e-mail de um pai repetido em duas fichas não vira uma pessoa, e a ficha do aluno também tem um e-mail. Sem separar "quem é o aluno" de "quem entra", não há como dizer quem recebe o acesso nem como um pai vê dois filhos com um login só. A LGPD (art. 14) pede cuidado extra com dados de criança e adolescente, o que reforça a regra por idade e o consentimento do responsável.

## Escopo

- Vale para a Área do Aluno (PWA) e para a seção "Acesso" da ficha no painel do gestor.
- Fora do ADR 11: o ADR 11 diz que o membership do aluno é a linha de `clients`. Com esta decisão, a ficha continua sendo o dado do aluno no espaço, mas o **membership de acesso** é `student_access`; a ficha sozinha não autentica ninguém.
- Não muda o cadastro atual: `guardians` continua como contato e parentesco; a ficha ganha só um indicador derivado ("tem acesso").
- Migração e RLS: `student_access` com `organization_id`, select pelo próprio `auth_user_id` e gestão pelos perfis do espaço; as consultas da Área do Aluno filtram por `client_id` dos vínculos ativos do usuário, nunca por e-mail.

## Alternativas

- **Login direto pelo e-mail da ficha ou do responsável.** Rejeitado: não resolve o pai com dois filhos (mesmo e-mail em duas fichas), e um e-mail digitado errado daria acesso aos dados de uma criança.
- **Colocar aluno e responsável em `public.users` com um perfil novo.** Rejeitado: `users` é um vínculo por espaço e por perfil da equipe; o responsável precisa de um vínculo por filho, e as permissões do aluno não são capability keys da operação.
- **Uma conta por filho, criada pelo pai.** Rejeitado: obriga e-mails alternativos e várias senhas, o mesmo atrito que o ADR 11 recusou.
- **Escopo por vínculo** (ex.: responsável que só vê o financeiro de um filho adulto, `scope: billing_only`). **Adiado em 21/10/2026, a pedido:** o modelo nasce com um campo `scope` reservado (valor único `full`), e a regra só será avaliada se aparecer a necessidade. Não construir tela nem regra para isso agora.

## Pendências

- Texto exato do consentimento do responsável para o acesso do adolescente, junto com os termos do [doc 24](../product/24-diretrizes-exclusao-e-lgpd.md).
- Comportamento ao inativar o aluno: os vínculos ficam `revoked` ou só perdem a visão? Decidir com a esteira de exclusão do doc 24.
