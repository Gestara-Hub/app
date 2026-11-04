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

- **Aluno:** atestado médico, termo de responsabilidade, autorização de imagem, laudo ou orientação médica, comprovante de graduação, contrato e outro.
- **Instrutor:** registro profissional (CREF), certificado de formação, contrato, antecedentes criminais e outro.
- **Outro:** ao escolher, aparece o campo "Nome do documento", obrigatório. Nos demais tipos o campo não aparece e a ficha mostra o nome do tipo; trocar de "Outro" para outro tipo limpa o nome.
- **Validade:** é opcional em todos. Atestado, CREF e antecedentes mostram o campo "Válido até" como esperado, com a frase "Avisamos antes de vencer".
- **Arquivo:** um por documento, foto ou PDF, até 10 MB.

## 3. Quem vê e quem mexe

| Perfil | Documentos do aluno | Documentos do instrutor |
| --- | --- | --- |
| Proprietário e gerente | Vê, anexa, edita e exclui | Vê, anexa, edita e exclui |
| Atendente | Vê, anexa, edita e exclui (é quem recebe o atestado na recepção) | Não vê |
| Professor | Vê e abre só os dos alunos das turmas dele (atestado e restrição importam na aula) | Não vê |

## 4. Validade e avisos

- **Situação:** sem validade, válido, "vence em breve" (até 30 dias antes) ou vencido. O último dia ainda vale.
- **Renovação:** por pessoa e tipo vale o documento de validade mais longa. Anexar o atestado novo tira o aviso do antigo, sem precisar apagar.
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

- Lembrete pelo WhatsApp para o aluno trazer o atestado novo (modelo de mensagem próprio).
- Exigir atestado válido para matricular em modalidades escolhidas (por exemplo, natação).
- Assinatura digital do termo pelo link, como o consentimento de menor.
