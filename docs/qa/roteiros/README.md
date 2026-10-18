# Roteiros de teste por área (outubro de 2026)

As 11 áreas da configuração inicial se resumem a 5 comportamentos. Um roteiro por grupo cobre todas:

| Roteiro | Área testada | Vale também para |
|---|---|---|
| [01-lutas.md](01-lutas.md) | Lutas | (única: faixas por modalidade, faixas por idade, graus) |
| [02-pilates-e-yoga.md](02-pilates-e-yoga.md) | Pilates e yoga | Funcional e crossfit (sem trilha) |
| [03-idiomas-e-reforco.md](03-idiomas-e-reforco.md) | Idiomas e reforço | Dança, Música, Natação e esportes (níveis e notas) |
| [04-gastronomia.md](04-gastronomia.md) | Gastronomia | Artes e artesanato, Beleza e cursos livres (curso com valor fechado) |
| [05-outra-area-pacote.md](05-outra-area-pacote.md) | Outra área | (única: nome próprio e pacote de aulas) |

## Antes de cada roteiro: começar do zero

1. Abra `http://localhost:3000` no Chrome.
2. Abra o console (F12, aba Console), cole e aperte Enter:

   ```js
   localStorage.clear(); sessionStorage.clear(); location.href = "/setup";
   ```

3. Se cair no login, clique em **Ana Ribeiro**. Você deve ver "Como se chama o seu espaço?".

## Datas

Os roteiros usam **hoje** como referência. Toda turma inclui o **dia da semana de hoje**, para a chamada ser feita na aula de hoje. Aluno matriculado hoje só aparece nas aulas de hoje em diante, e o pacote só paga aula a partir do dia da compra.

## No fim de cada roteiro: mandar o JSON

No console, cole e aperte Enter. O JSON do espaço vai para a área de transferência:

```js
(() => {
  const db = JSON.parse(localStorage.getItem("gestarahub:db")).data;
  const t = db.tenants[db.activeOrganizationId];
  const keys = ["organization", "unit", "categories", "professionals", "plans", "lessonPackages", "classGroups",
    "clients", "enrollments", "charges", "studentPackages", "attendances", "assessments", "sessionOverrides",
    "messageLogs", "auditLog"];
  copy(JSON.stringify(Object.fromEntries(keys.filter((k) => k in t).map((k) => [k, t[k]])), null, 2));
  return "JSON copiado";
})();
```

Cole na conversa (ou salve como `.json` e mande o arquivo), dizendo o número do roteiro e a data de hoje. Mande também, se houver, o que estranhou na tela com um print.
