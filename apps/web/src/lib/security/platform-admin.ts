/**
 * Administrador da plataforma (painel `apps/admin`, doc technical/26): a conta de
 * login leva `app_metadata.platform = true`, gravado so pelo servidor. Esta
 * conta nunca vira usuario de um espaco: o app dos clientes recusa antes de
 * qualquer consulta. O outro sentido (cliente no painel) e do `apps/admin`.
 */
export function isPlatformAdminUser(user: { app_metadata?: Record<string, unknown> | null } | null | undefined): boolean {
  return user?.app_metadata?.platform === true;
}
