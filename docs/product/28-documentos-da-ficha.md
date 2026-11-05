# 28. Documentos da ficha (aluno e instrutor)

Decidido e feito em 04/11/2026. Guarda na ficha os documentos que o espaço pede no papel ou no WhatsApp: atestado, termo assinado, autorização de imagem, registro profissional. O ganho principal é o aviso antes de vencer.

## 1. Por que existe

| Segmento | Documento | Vence? |
| --- | --- | --- |
| Natação, lutas, funcional e crossfit | Atestado médico de aptidão | Sim, em geral de 6 a 12 meses |
| Lutas, esportes, menores de idade | Termo de responsabilidade assinado | Não |
| Dança, lutas, escolinhas | Autorização de uso de imagem | Não |
| Pilates, aulas com restrição | Laudo ou orientação médica | Não |
| Lutas | Comprovante de graduação de outra academia | Não |
| Instrutor de educação física | Registro profissional (CREF) | Sim |
| Espaços com crianças | Antecedentes criminais do instrutor | Sim |

## 2. Tipos

Em negrito, os que entraram em 04/11/2026 (segunda leva). No formulário são dois campos: **Categoria** (o grupo) e **Tipo**, que mostra só os tipos daquela categoria. Na categoria "Outro", que tem um tipo só, o campo Tipo não aparece e o "Nome do documento" vem direto. Na edição, a categoria já vem do tipo guardado.

**Aluno**

| Grupo | Tipos | Validade esperada |
| --- | --- | --- |
| Saúde | Atestado médico, **Ficha de anamnese ou PAR-Q**, **Exame dermatológico**, Laudo ou orientação médica | Atestado, anamnese e exame |
| Identificação | **Documento de identificação**, **Documento do responsável**, **Comprovante de residência** | Não |
| Autorizações e termos | Termo de responsabilidade, Autorização de imagem, **Autorização para buscar o aluno**, **Autorização para competição ou viagem** | Não |
| Esporte | Comprovante de graduação, **Filiação à federação** | Filiação |
| Contratos e financeiro | Contrato, **Comprovante para desconto** | Comprovante para desconto |
| Outro | Outro | Não |

**Instrutor**

| Grupo | Tipos | Validade esperada |
| --- | --- | --- |
| Identificação | **Documento de identificação**, **Comprovante de residência** | Não |
| Formação e registro | Registro profissional (CREF), **Diploma**, Certificado de formação, **Primeiros socorros**, **Salvamento aquático**, **Filiação à federação** | CREF, primeiros socorros, salvamento e filiação |
| Contratos | Contrato, **Cartão CNPJ ou MEI**, Antecedentes criminais | Antecedentes |
| Outro | Outro | Não |

- **Nome livre:** no "Outro" é obrigatório ("Nome do documento") e vira o nome na ficha. Na identificação é o "Qual documento" (RG, CIN, CNH), opcional, e a ficha mostra "Documento de identificação (CNH)". Nos demais tipos o campo não aparece; trocar para um tipo sem nome livre apaga o nome antigo.
- **Validade:** opcional em todos. Nos tipos com validade esperada, o campo "Válido até" vem como esperado, com "Avisamos antes de vencer".
- **Arquivo:** um por documento, foto ou PDF, até 4 MB (teto de todo envio do sistema).
- **Fora de propósito:** dados bancários, carteira de vacinação e um tipo para cada documento de identidade. Cópia de documento é dado pessoal: guardar só com motivo (contrato, menor); o CPF já está no cadastro.

### 2.1 Acrescentar, mudar ou tirar um tipo

Os tipos ficam numa lista só, no código: `packages/core/src/person-documents.ts` (`CLIENT_DOCUMENT_KINDS` e `PROFESSIONAL_DOCUMENT_KINDS`). O banco não lista os tipos (migração 85, só confere o formato do código); a gravação passa pelo servidor, que confere o tipo.

- **Acrescentar:** uma linha na lista (código, nome, grupo, validade esperada, nome livre), o código no contrato (`packages/contracts/src/person-document.ts`) e o ícone em `features/person-documents/document-kind-icons.tsx` (o TypeScript acusa o ícone que falta). Sem migração.
- **Mudar o nome ou o grupo:** só a linha da lista. Os documentos guardados passam a mostrar o nome novo.
- **Tirar:** marcar `retired: true` na linha. O tipo sai da seleção de documento novo; os já guardados continuam com nome, ícone e aviso. Apagar a linha só depois de passar os documentos antigos para outro tipo (por exemplo "Outro", com o nome antigo no título).
- **Tipos por espaço** (cada academia criando os seus pela tela) ficam para quando houver pedido: seria uma tabela de tipos por espaço, com os de hoje como padrão.

## 3. Quem vê e quem mexe

| Perfil | Documentos do aluno | Documentos do instrutor |
| --- | --- | --- |
| Proprietário e gerente | Vê, anexa, edita e exclui | Vê, anexa, edita e exclui |
| Atendente | Vê, anexa, edita e exclui (é quem recebe o atestado na recepção) | Não vê |
| Professor | Vê e abre só os dos alunos das turmas dele (atestado e restrição importam na aula) | Não vê |

## 4. Validade e avisos

- **Situação:** sem validade, válido, "vence em breve" (até 30 dias antes) ou vencido. O último dia ainda vale.
- **Renovação:** por pessoa e tipo vale o documento de validade mais longa. Anexar o atestado novo tira o aviso do antigo, sem precisar apagar. Nos tipos com "Qual documento", o documento informado também separa: a CNH vencida não some porque o RG está em dia.
- **Sino:** até 5 avisos, o mais urgente primeiro ("Atestado médico de Ana", "Venceu há 3 dias"). O do aluno abre a ficha na seção Documentos; o do instrutor abre a Equipe. Só de alunos e instrutores ativos.
- **Topo da ficha do aluno:** cartão "Atestado médico vencido" (vermelho) ou "vence em breve", com "Ver documentos".

## 5. Onde fica na tela

- **Aluno:** seção "Documentos" na sanfona da ficha, antes de "Cadastro". O resumo diz quantos são e se algum vence.
- **Instrutor:** "Documentos" no menu ⋮ da linha em Equipe, que abre uma gaveta com a mesma lista.
- **Lista:** nome, situação da validade, nome e tamanho do arquivo e observação. Clicar abre o arquivo numa aba nova. O menu tem Abrir, Editar e Excluir (com confirmação).

## 6. LGPD e segurança

- Atestado e laudo são **dado de saúde**, dado sensível na LGPD.
- O arquivo fica no armazenamento privado do espaço. O download passa por uma rota própria (`/api/person-documents/[id]`) que confere a sessão, o segundo fator e as regras da seção 3. A rota genérica de anexos recusa o arquivo de um documento.
- Ler a tabela direto pelo banco: só proprietário, gerente e atendente. O professor recebe só pelo servidor, que confere a turma.
- **Excluir apaga o arquivo** do armazenamento depois da gravação, além da linha.
- A exportação dos dados do espaço (painel admin) leva os documentos.
- Aluno ou instrutor apagado de vez apaga os documentos junto (chave com `ON DELETE CASCADE`). Hoje o app só inativa; os arquivos ficam até a exclusão.

## 7. Como foi feito

- Contrato `PersonDocument` em `packages/contracts/src/person-document.ts`; regras puras (tipos, validade, frases) em `packages/core/src/person-documents.ts`, com teste.
- Tabela `person_documents` (migração `20261104000083`), coleção `personDocuments` no mundo e serviço `services/personDocuments` (listar, anexar, editar, excluir e vencendo).
- Tela em `features/person-documents` (painel, gaveta do formulário e gaveta do instrutor); aviso no sino em `features/dashboard/bell-alerts.ts`.

## 8. Para depois

- Usar o documento devolvido pelo salvar direto na lista (adicionar e editar) e tirar a linha ao excluir, com a conferência em segundo plano, em vez de buscar a lista de novo. Hoje a lista é buscada de novo e mostra um item de carregamento (adicionar) ou fica esmaecida (editar e excluir) até chegar. Detalhe e ordem das telas em `pendencias.md`.
- Lembrete pelo WhatsApp para o aluno trazer o atestado novo (modelo de mensagem próprio).
- Exigir atestado válido para matricular em modalidades escolhidas (por exemplo, natação).
- Assinatura digital do termo pelo link, como o consentimento de menor.
