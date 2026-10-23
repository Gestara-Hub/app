import type {
  AuditChange,
  CreateUser,
  Id,
  UpdateUser,
  User,
  UserFilter,
  UserView,
} from "@gestarahub/contracts";
import { allTenants, store } from "@/mocks/store";
import { userProfileLabel } from "@/lib/labels";
import {
  newId,
  notFoundError,
  nowIso,
  readOp,
  writeOp,
  textIncludes,
  validationError,
} from "@/services/world/ops";
import { realAccountInBrowser } from "../world/delegate";
import { auditLogService } from "../auditLogService";
import {
  createUserAndInviteAction,
  inactivateUserInDb,
  listUsersFromDb,
  resendInvitationAction,
  updateUserInDb,
} from "../usersBackend";
import {
  NOT_FOUND,
  clone,
  ensureEmailUnique,
  ensureNotLastOwner,
  ensureNotSelfPrivilegeChange,
  ensureProfessionalFree,
  toView,
  toViewWith,
  validateUser,
} from "./userRules";
import type { UserSwitchOption } from "./userRules";

export const usersService = {
  list(filter?: UserFilter): Promise<UserView[]> {
    return readOp(async () => {
      if (realAccountInBrowser()) {
        const dbUsers = await listUsersFromDb(store.organization.id);
        const dbIds = new Set(dbUsers.map((u) => u.id));
        store.users = [
          ...store.users.filter((u) =>
            u.organizationId === store.organization.id ? !dbIds.has(u.id) : true,
          ),
          ...dbUsers,
        ];

        let result = dbUsers;
        if (filter?.search) {
          const term = filter.search.toLowerCase();
          result = result.filter(
            (u) =>
              u.name.toLowerCase().includes(term) ||
              u.email.toLowerCase().includes(term),
          );
        }
        if (filter?.status) {
          result = result.filter((u) => u.status === filter.status);
        }
        if (filter?.profile) {
          result = result.filter((u) => u.profile === filter.profile);
        }
        return clone(
          [...result].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
        );
      }

      let result = store.users;
      if (filter?.search) {
        const term = filter.search;
        result = result.filter(
          (u) => textIncludes(u.name, term) || textIncludes(u.email, term),
        );
      }
      if (filter?.status) {
        result = result.filter((u) => u.status === filter.status);
      }
      if (filter?.profile) {
        result = result.filter((u) => u.profile === filter.profile);
      }
      return clone(
        [...result]
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
          .map(toView),
      );
    });
  },

  // Usuarios ATIVOS de TODOS os tenants (cross-tenant), para o login e o
  // "trocar usuario" do demo — escolher um usuario de outra org troca o tenant.
  listForSwitch(): Promise<UserSwitchOption[]> {
    return readOp(() => {
      const options: UserSwitchOption[] = [];
      for (const tenant of allTenants()) {
        // Deixar apenas o ambiente de academia / Ana Ribeiro no demo por enquanto
        if (tenant.organization.id === "org-barbearia") continue;
        for (const u of tenant.users) {
          if (u.status !== "active") continue;
          if (u.id === "usr-marcelo" || u.name === "Marcelo Andrade") continue;
          options.push({
            user: toViewWith(tenant.professionals, u),
            organizationId: tenant.organization.id,
            organizationName: tenant.organization.name,
            onboardingCompleted: Boolean(tenant.organization.settings?.onboardingCompleted),
          });
        }
      }
      return clone(
        options.sort(
          (a, b) =>
            a.organizationName.localeCompare(b.organizationName, "pt-BR") ||
            a.user.name.localeCompare(b.user.name, "pt-BR"),
        ),
      );
    });
  },

  getById(id: Id): Promise<UserView> {
    return readOp(() => {
      const found = store.users.find((u) => u.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(toView(found));
    });
  },

  /**
   * `inviteSent`: o e-mail do convite saiu. Falhou, o usuario fica criado e
   * `inviteError` diz o motivo ("Reenviar convite" na lista tenta de novo).
   */
  create(
    payload: CreateUser,
    sendInvite = true,
  ): Promise<UserView & { inviteSent: boolean; inviteError?: string }> {
    return writeOp(async () => {
      validateUser(payload, { partial: false });

      if (realAccountInBrowser()) {
        const res = await createUserAndInviteAction(
          store.organization.id,
          payload,
          sendInvite,
        );
        if (!res.success || !res.user) {
          throw validationError([
            { field: "email", message: res.error || "Erro ao criar usuário." },
          ]);
        }
        store.users = [
          ...store.users.filter((u) => u.id !== res.user!.id),
          res.user,
        ];

        auditLogService.record({
          action: "created",
          target: {
            type: "user",
            id: res.user.id,
            label: res.user.name,
            profile: res.user.profile,
          },
          predicate: `criou o usuário ${res.user.name} (${userProfileLabel(res.user.profile)}) com convite por e-mail`,
          security: true,
        });

        return { ...clone(res.user), inviteSent: Boolean(res.inviteSent), inviteError: res.inviteError };
      }

      ensureEmailUnique(payload.email);
      ensureProfessionalFree(payload.professionalId || undefined, payload.status ?? "active");
      const ts = nowIso();
      const user: User = {
        id: newId(),
        organizationId: store.organization.id,
        name: payload.name.trim(),
        email: payload.email.trim(),
        profile: payload.profile,
        professionalId: payload.professionalId || undefined,
        status: payload.status ?? "active",
        createdAt: ts,
        updatedAt: ts,
      };
      store.users.push(user);
      auditLogService.record({
        action: "created",
        target: { type: "user", id: user.id, label: user.name, profile: user.profile },
        predicate: `criou o usuário ${user.name} (${userProfileLabel(user.profile)})`,
        security: true,
      });
      return { ...clone({ ...toView(user), pendingInvite: sendInvite }), inviteSent: sendInvite };
    });
  },

  update(id: Id, payload: UpdateUser): Promise<UserView> {
    return writeOp(async () => {
      validateUser(payload, { partial: true });

      if (realAccountInBrowser()) {
        const res = await updateUserInDb(store.organization.id, id, payload);
        if (!res.success) {
          throw validationError([
            { field: "email", message: res.error || "Erro ao atualizar usuário." },
          ]);
        }
        const updatedUsers = await listUsersFromDb(store.organization.id);
        const match = updatedUsers.find((u) => u.id === id);
        if (match) {
          store.users = [
            ...store.users.filter((u) => u.id !== id),
            match,
          ];
          return clone(match);
        }
      }

      const idx = store.users.findIndex((u) => u.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      if (payload.email !== undefined) ensureEmailUnique(payload.email, id);
      const current = store.users[idx];
      ensureNotSelfPrivilegeChange(current, payload);
      ensureNotLastOwner(current, payload);
      const updated: User = {
        ...current,
        ...payload,
        name: payload.name?.trim() ?? current.name,
        email: payload.email?.trim() ?? current.email,
        professionalId: Object.prototype.hasOwnProperty.call(
          payload,
          "professionalId",
        )
          ? payload.professionalId || undefined
          : current.professionalId,
        updatedAt: nowIso(),
      };
      ensureProfessionalFree(updated.professionalId, updated.status, id);
      store.users[idx] = updated;
      const changes: AuditChange[] = [];
      if (updated.profile !== current.profile) {
        changes.push({
          field: "profile",
          label: "Perfil",
          before: userProfileLabel(current.profile),
          after: userProfileLabel(updated.profile),
        });
      }
      const reactivated = current.status === "inactive" && updated.status === "active";
      const inactivated = current.status === "active" && updated.status === "inactive";
      const action = reactivated ? "activated" : inactivated ? "inactivated" : "updated";
      const verb = reactivated ? "reativou" : inactivated ? "inativou" : "atualizou";
      auditLogService.record({
        action,
        target: { type: "user", id: updated.id, label: updated.name, profile: updated.profile },
        predicate: `${verb} o usuário ${updated.name}`,
        changes,
        security: true,
      });
      return clone(toView(updated));
    });
  },

  // remove = inativacao logica; usuario inativo nao pode logar nem e sugerido.
  remove(id: Id): Promise<void> {
    return writeOp(async () => {
      if (realAccountInBrowser()) {
        const res = await inactivateUserInDb(store.organization.id, id);
        if (!res.success) {
          throw validationError([
            { field: "status", message: res.error || "Erro ao inativar usuário." },
          ]);
        }
        const user = store.users.find((u) => u.id === id);
        if (user) user.status = "inactive";
        return;
      }

      const idx = store.users.findIndex((u) => u.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      ensureNotSelfPrivilegeChange(store.users[idx], { status: "inactive" });
      ensureNotLastOwner(store.users[idx], { status: "inactive" });
      const target = store.users[idx];
      store.users[idx] = {
        ...store.users[idx],
        status: "inactive",
        updatedAt: nowIso(),
      };
      auditLogService.record({
        action: "inactivated",
        target: { type: "user", id, label: target.name, profile: target.profile },
        predicate: `inativou o usuário ${target.name}`,
        security: true,
      });
    });
  },

  resendInvite(id: Id): Promise<{ success: boolean; error?: string }> {
    return writeOp(async () => {
      if (realAccountInBrowser()) {
        return resendInvitationAction(store.organization.id, id);
      }
      return { success: true };
    });
  },
};
