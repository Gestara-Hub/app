import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestTenant, ownerSql, signInAs, type TestTenant } from "@/test/db";

/**
 * Comunicados do painel no app dos clientes (doc technical/26, fase 5): so
 * chegam os que valem para o espaco da sessao, a dispensa e por pessoa e o
 * urgente nao se dispensa.
 */
const actions = await import("../announcementActions");
const { unwrap } = await import("@/services/server/action");

let tenant: TestTenant;
let other: TestTenant;
const owner = await ownerSql();
const titles = ["Aviso de teste geral", "Aviso de teste só deste espaço", "Aviso de teste urgente"];

beforeAll(async () => {
  tenant = await createTestTenant({ name: "Espaço de comunicado" });
  other = await createTestTenant({ name: "Outro espaço de comunicado" });
  await owner`
    insert into platform.announcements (title, body, severity, audience, audience_filter) values
      (${titles[0]}, 'Texto geral', 'info', 'all', '{}'),
      (${titles[1]}, 'Texto do espaço', 'warning', 'spaces', ${owner.json({ spaces: [tenant.organizationId] } as never)}),
      (${titles[2]}, 'Texto urgente', 'urgent', 'all', '{}')`;
});

afterAll(async () => {
  await owner`delete from platform.announcements where title = any(${titles})`;
  await tenant.remove();
  await other.remove();
  await owner.end();
});

const mine = async () => (await unwrap(actions.listAnnouncementsAction())).filter((a) => titles.includes(a.title));

describe("comunicados no app", () => {
  it("entrega só o que vale para o espaço da sessão, o urgente primeiro", async () => {
    await signInAs(tenant.owner);
    expect((await mine()).map((a) => a.title)).toEqual([titles[2], titles[1], titles[0]]);
    await signInAs(other.owner);
    expect((await mine()).map((a) => a.title)).toEqual([titles[2], titles[0]]);
  });

  it("dispensa vale só para a pessoa e o urgente não se dispensa", async () => {
    await signInAs(tenant.owner);
    const list = await mine();
    const general = list.find((a) => a.title === titles[0])!;
    const urgent = list.find((a) => a.title === titles[2])!;
    await unwrap(actions.dismissAnnouncementAction(general.id));
    await unwrap(actions.dismissAnnouncementAction(urgent.id));
    expect((await mine()).map((a) => a.title)).toEqual([titles[2], titles[1]]);
    // O mesmo comunicado continua chegando ao outro espaço.
    await signInAs(other.owner);
    expect((await mine()).map((a) => a.title)).toContain(titles[0]);
  });

  it("recusa id inválido", async () => {
    await signInAs(tenant.owner);
    await expect(unwrap(actions.dismissAnnouncementAction("nao-e-uuid"))).rejects.toBeDefined();
  });
});
