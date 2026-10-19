# Roteiros de teste por área (outubro de 2026)

As 11 áreas da configuração inicial se resumem a 5 comportamentos. Um roteiro por grupo cobre todas.

Os roteiros são longos de propósito: juntos, passam por todos os fluxos do modelo de turmas. Cada um tem partes (A, B, C...) que dá para rodar em dias diferentes, sem limpar os dados entre elas.

| Roteiro | Área testada | Vale também para |
|---|---|---|
| [01-lutas.md](01-lutas.md) | Lutas | (única: faixas por modalidade, faixas por idade, graus) |
| [02-pilates-e-yoga.md](02-pilates-e-yoga.md) | Pilates e yoga | Funcional e crossfit (sem trilha) |
| [03-idiomas-e-reforco.md](03-idiomas-e-reforco.md) | Idiomas e reforço | Dança, Música, Natação e esportes (níveis e notas) |
| [04-gastronomia.md](04-gastronomia.md) | Gastronomia | Artes e artesanato, Beleza e cursos livres (curso com valor fechado) |
| [05-outra-area-pacote.md](05-outra-area-pacote.md) | Outra área | (única: nome próprio e pacote de aulas) |

## Onde está cada fluxo

| Fluxo | Roteiro |
|---|---|
| Landing, cadastro, login, 404, rota protegida | 03 A |
| Configuração inicial (cada tipo de área) | todos, Parte A; Outra área no 05 A |
| Horários, regras da mensalidade, modalidades, trilhas | 01 A, 02 A e B |
| Equipe, cargos, perfis de acesso, professor só nas suas turmas | 01 A e K |
| Turmas: criar, editar, capacidade, horário, desativar | 01 B e J |
| Matrícula, lista de espera, promoção | 01 D, 04 H |
| Chamada, avulsa, experimental, registro de aula | 01 E a G, 02 G |
| Graduação, graus, faixas por idade, ponto de partida | 01 H |
| Níveis e notas (todas as escalas, boletim) | 03 D e E |
| Troca de instrutor, calendário | 01 I |
| Planos, formas de cobrança, descontos, bolsa | 02 B a D |
| Cobranças: pagar, comprovante, desfazer, cancelar, atraso | 02 E |
| Financeiro: lançamentos, repetição, categorias, professores | 02 H, 05 J |
| Plano Pro: pagamento online, Pix Automático | 02 I |
| Curso com parcelas, rematrícula, certificado | 04 |
| Pacote de aulas (catálogo, venda, uso, renovação) | 05 |
| Ficha do aluno, avisos, aniversário, responsáveis | 03 C e F |
| Comunicação (assistido e WhatsApp oficial) | 03 G e H |
| Relatórios | 02 J, 03 I, 04 L, 05 K |
| Configurações gerais, tema, endereço | 03 J |
| Auditoria | 01 L, 05 K |

## Antes de cada roteiro: começar do zero

1. Abra `http://localhost:3000` no Chrome.
2. Abra o console (F12, aba Console), cole e aperte Enter:

   ```js
   localStorage.clear(); sessionStorage.clear(); location.href = "/setup";
   ```

3. Se cair no login, clique em **Ana Ribeiro**. Você deve ver "Como se chama o seu espaço?".

Outra forma, de dentro do app: Configurações > **Dados** > "Apagar dados da demonstração". O roteiro 03 começa assim, pelo cadastro de uma conta nova.

Só a dona (Ana Ribeiro, ou quem criou a conta) existe no começo. Os outros perfis são criados em Usuários e trocados pelo menu do topo (roteiro 01 K).

## Datas

Os roteiros usam **hoje** como referência. Toda turma inclui o **dia da semana de hoje**, para a chamada ser feita na aula de hoje. Aluno matriculado hoje só aparece nas aulas de hoje em diante, e o pacote só paga aula a partir do dia da compra.

## No fim de cada roteiro: mandar o JSON

No console, cole e aperte Enter. O JSON do espaço vai para a área de transferência:

```js
(() => {
  const db = JSON.parse(localStorage.getItem("gestarahub:db")).data;
  const t = db.tenants[db.activeOrganizationId];
  const keys = ["organization", "unit", "users", "categories", "professionals", "roles", "plans", "lessonPackages",
    "classGroups", "clients", "enrollments", "waitlist", "reservations", "charges", "studentPackages", "attendances",
    "assessments", "sessionOverrides", "financialEntries", "financialRecurrences", "financialCategories",
    "teacherPayRules", "teacherPayouts", "onlinePayments", "recurringAuthorizations", "messageTemplates",
    "whatsAppConnection", "certificateTemplate", "messageLogs", "auditLog"];
  copy(JSON.stringify(Object.fromEntries(keys.filter((k) => k in t).map((k) => [k, t[k]])), null, 2));
  return "JSON copiado";
})();
```

Cole na conversa (ou salve como `.json` e mande o arquivo), dizendo o número do roteiro e a data de hoje. Mande também, se houver, o que estranhou na tela com um print.
