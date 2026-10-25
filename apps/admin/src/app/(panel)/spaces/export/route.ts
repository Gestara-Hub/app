import { NextResponse, type NextRequest } from "next/server";
import { recordAudit } from "@/lib/server/audit";
import { getAdminContext } from "@/lib/server/context";
import { SPACE_SITUATIONS, SPACE_SORTS, listSpaces, type SpaceFilters } from "@/lib/server/spaces";
import { normalizeSearch, pickOne } from "@/lib/list-filters";
import { can } from "@/lib/permissions";
import { AREA_LABEL, planName, planSituation } from "@/lib/space-plan";
import { brasiliaDay } from "@/lib/sla";

/** CSV da lista filtrada. Sem dado pessoal: nem dono, nem e-mail, nem aluno. */
const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export async function GET(request: NextRequest) {
  const ctx = await getAdminContext();
  if (ctx.stage !== "ok" || !can(ctx.admin.role, "spaces:view")) return new NextResponse("Sem acesso.", { status: 403 });
  const p = request.nextUrl.searchParams;
  const pick = pickOne;
  const filters: SpaceFilters = {
    q: normalizeSearch(p.get("q")),
    tier: pick(p.get("tier"), ["free", "pro", "scale"] as const),
    situation: pick(p.get("situation"), SPACE_SITUATIONS),
    area: p.get("area") && (p.get("area") as string) in AREA_LABEL ? (p.get("area") as string) : undefined,
    createdWithin: p.get("created") === "7" ? 7 : p.get("created") === "30" ? 30 : undefined,
    sort: pick(p.get("sort"), SPACE_SORTS),
    page: 1,
  };
  const { rows } = await listSpaces(filters, { all: true });
  const today = brasiliaDay(new Date());
  const lines = [
    ["Código", "Espaço", "Área", "Plano", "Situação do plano", "Alunos ativos", "Turmas ativas", "Pessoas ativas", "Último acesso", "Criado em"].map(csvCell).join(";"),
    ...rows.map((r) =>
      [
        r.id,
        r.name,
        r.customAreaName || AREA_LABEL[r.area ?? ""] || "",
        planName(r.subscription),
        planSituation(r.subscription, today).label,
        r.studentsActive,
        r.classesActive,
        r.usersActive,
        r.lastSignInAt ? r.lastSignInAt.toISOString().slice(0, 16).replace("T", " ") : "",
        r.createdAt.toISOString().slice(0, 10),
      ]
        .map(csvCell)
        .join(";"),
    ),
  ];
  await recordAudit({ admin: ctx.admin, action: "space.export", target: { rows: rows.length, filters: Object.fromEntries(p.entries()) } });
  return new NextResponse(`﻿${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="espacos-${today}.csv"`,
    },
  });
}
