# 18. Documentos em PDF (relatórios, recibos, termos)

Data: 2026-10-23. Status: implementado nas fases 1 a 4.

## Decisão

Todo documento que o espaço baixa ou imprime usa **um layout só**, montado a partir de um modelo de dados único (`DocumentModel`, em `@gestarahub/contracts`). Mudar o layout muda todos os documentos de uma vez; um documento novo só monta os dados nesse formato.

- **Tela:** prévia em HTML (`components/shared/document-preview.tsx`), no mesmo desenho do PDF.
- **PDF:** gerado no servidor com `@react-pdf/renderer` (`lib/documents/document-pdf.tsx`), em rotas `app/api/documents/*`. O botão é **Baixar PDF** e abre em outra aba.
- **CSV:** gerado do mesmo modelo (`lib/documents/csv.ts`), no formato do Excel em pt-BR (BOM, `;`, "250,00").
- **Logo:** a do espaço (a do modelo de certificado) quando existe; sem ela, a do GestaraHub (`public/documents/gestarahub-logo.png`). O certificado só usa a do espaço, como na tela.
- **Horário:** datas e horas sempre no horário do Brasil (`America/Sao_Paulo`), também no servidor.
- **Conta de demonstração** (sem banco): a prévia é a mesma, o PDF sai pela impressão do navegador e o CSV é montado no navegador. Os botões de documentos que só existem no servidor (recibo, declaração, termo, boletim, demonstrativo, extrato) não aparecem.

## Blocos do modelo

Cabeçalho (nome do espaço, unidade, meta à direita), título e subtítulo, e blocos: indicadores (até 4), campos (rótulo e valor), tabela (com numeração, tons, total e coluna de assinatura), texto e linhas de assinatura. Rodapé fixo com "Emitido pelo GestaraHub" e a página.

## Documentos

| Documento | Onde fica o botão | Rota | Permissão |
| --- | --- | --- | --- |
| 8 relatórios do catálogo | Relatórios, relatório aberto | `/api/documents/reports/<tipo>?competencia=&turma=&aula=&formato=` | `reports:view` + `reports:export` (Pro conferido no serviço) |
| Comprovante do pagamento online | Página pública `/p/<código>` paga | `/p/<código>/comprovante` | público (só o que a página mostra) |
| Recibo de pagamento | Cobrança paga no espaço (ícone ao lado de Desfazer e no menu) | `/api/documents/charges/<id>/receipt` | `billing:view` |
| Declaração de pagamentos do ano | Ficha do aluno, aba de cobranças | `/api/documents/students/<id>/payments?ano=` | `billing:view` |
| Demonstrativo do professor | Pagamento do mês do professor (ícone no topo) | `/api/documents/teacher-pay/<profissional>?competencia=` | `finance:view` |
| Certificado de conclusão | Tela do certificado | `/api/documents/certificates/<matrícula>` | `classes:view` (Pro e curso terminado no serviço) |
| Termo de autorização do responsável | Ficha do aluno menor, bloco do termo | `/api/documents/students/<id>/consent` | `clients:view` |
| Boletim do aluno | Gaveta de Notas | `/api/documents/students/<id>/report-card` | `clients:view` |
| Extrato de recebimentos online | Recebimentos online, "Extrato em PDF" | `/api/documents/online-payments?competencia=` | `finance:view` |

As rotas resolvem o espaço pela sessão (`requireTenant`) e rodam os mesmos serviços da tela dentro de `runInWorld`. Erro de regra vira JSON com o status certo (401 sem sessão, 403 sem permissão ou fora do plano, 404, 422).

## Pagador no recibo e na declaração

O mesmo da cobrança online (`resolveOnlinePayer`): aluno maior com o próprio CPF; menor, o responsável financeiro. Sem CPF, sai só o nome.

## Testes

- `lib/documents/__tests__/*.test.ts` gera CSV e PDF de todos os documentos. Com `DOCUMENTS_OUT=<pasta>` grava os PDFs para conferir o layout.
- e2e: `relatorios.spec.ts` e `dinheiro-financeiro.spec.ts` usam os links do servidor (CSV baixado da rota, PDF com `content-type` certo).

## Arquivos

- Modelo: `packages/contracts/src/document.ts`.
- Montagem (puro): `lib/documents/report-documents.ts`, `payment-receipt.ts`, `payment-documents.ts`, `student-documents.ts`; formatação em `format.ts`.
- PDF: `lib/documents/document-pdf.tsx` e `certificate-pdf.tsx` (os três modelos do certificado).
- Servidor: `services/server/documents.tsx` (logo, PDF, CSV, erros), `reportDocument.ts`, `paymentDocuments.ts`, `studentDocuments.ts`, `certificateDocument.tsx`.
