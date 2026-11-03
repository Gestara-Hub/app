import { beforeEach, describe, expect, it } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import { usersService } from "@/services/users";
import { createInstructor, resetAcademy } from "@/test/academy";

const SELF_MESSAGE = "Você não pode alterar o seu próprio perfil ou status.";

describe("usuário não altera o próprio perfil nem o próprio status", () => {
  // Um 2o proprietario ativo: a recusa vem da regra de "si mesmo", nao da de ultimo proprietario.
  let other: { id: string };
  beforeEach(async () => {
    resetAcademy();
    other = await usersService.create({ name: "Bia Souza", email: "bia@academiax.com", profile: "owner", status: "active" });
    setCurrentActor({ userId: other.id, name: "Bia Souza", profile: "owner" });
  });

  it("recusa mudar o próprio perfil", async () => {
    await expect(usersService.update(other.id, { profile: "manager" })).rejects.toMatchObject({
      fields: [{ field: "profile", message: SELF_MESSAGE }],
    });
    expect(store.users.find((u) => u.id === other.id)?.profile).toBe("owner");
  });

  it("recusa mudar o próprio status", async () => {
    await expect(usersService.update(other.id, { status: "inactive" })).rejects.toMatchObject({
      fields: [{ field: "status", message: SELF_MESSAGE }],
    });
    expect(store.users.find((u) => u.id === other.id)?.status).toBe("active");
  });

  it("recusa se inativar pelo remove", async () => {
    await expect(usersService.remove(other.id)).rejects.toMatchObject({
      fields: [{ field: "status", message: SELF_MESSAGE }],
    });
    expect(store.users.find((u) => u.id === other.id)?.status).toBe("active");
  });

  it("aceita editar o próprio nome (reenviando o mesmo perfil e status)", async () => {
    const updated = await usersService.update(other.id, { name: "Bia S.", profile: "owner", status: "active" });
    expect(updated.name).toBe("Bia S.");
  });

  it("outro proprietário pode mudar o perfil e inativar", async () => {
    setCurrentActor({ userId: "usr-ac-ana", name: "Ana Ribeiro", profile: "owner" });
    await usersService.update(other.id, { profile: "manager" });
    await usersService.remove(other.id);
    expect(store.users.find((u) => u.id === other.id)).toMatchObject({ profile: "manager", status: "inactive" });
  });
});

describe("um usuário ativo por profissional (ACE-08)", () => {
  beforeEach(() => resetAcademy());

  it("recusa ligar um segundo usuário ao mesmo profissional; inativo libera", async () => {
    const teacher = await createInstructor("Carlos");
    const carlos = await usersService.create({
      name: "Carlos",
      email: "carlos@academiax.com",
      profile: "professional",
      professionalId: teacher.id,
      status: "active",
    });
    const second = { name: "Carlos 2", email: "carlos2@academiax.com", profile: "professional" as const, professionalId: teacher.id, status: "active" as const };
    await expect(usersService.create(second)).rejects.toMatchObject({
      fields: [{ field: "professionalId", message: "Este profissional já está ligado ao usuário Carlos." }],
    });

    await usersService.update(carlos.id, { status: "inactive" });
    const other = await usersService.create(second);
    expect(other.professionalId).toBe(teacher.id);
    // Reativar o antigo agora esbarra no novo.
    await expect(usersService.update(carlos.id, { status: "active" })).rejects.toMatchObject({
      fields: [{ field: "professionalId" }],
    });
  });
});

describe("bloqueio de alteração de e-mail de usuário confirmado", () => {
  beforeEach(() => resetAcademy());

  it("recusa alterar e-mail de usuário já ativo/confirmado", async () => {
    // usr-ac-ana é usuário confirmado sem convite pendente
    await expect(
      usersService.update("usr-ac-ana", { email: "novo@academiax.com" }),
    ).rejects.toMatchObject({
      fields: [
        {
          field: "email",
          message: "O e-mail de acesso não pode ser alterado após a ativação da conta.",
        },
      ],
    });
  });

  it("permite alterar e-mail de usuário com convite pendente", async () => {
    const created = await usersService.create(
      {
        name: "Pendente",
        email: "pendente@academiax.com",
        profile: "attendant",
        status: "active",
      },
      true, // sendInvite = true cria convite pendente
    );

    const updated = await usersService.update(created.id, {
      email: "novo.pendente@academiax.com",
    });

    expect(updated.email).toBe("novo.pendente@academiax.com");
  });
});
