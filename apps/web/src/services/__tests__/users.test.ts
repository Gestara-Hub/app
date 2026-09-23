import { beforeEach, describe, expect, it } from "vitest";
import { setCurrentActor } from "@/mocks/currentActor";
import { store } from "@/mocks/store";
import { usersService } from "@/services/usersService";
import { resetAcademy } from "@/test/academy";

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
