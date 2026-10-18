"use client";

import { PageHeader } from "@/components/layout/page-header";
import { AuditLogList } from "./audit-log-list";

export function AuditView() {
  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Quem fez o quê e quando."
      />
      <AuditLogList />
    </>
  );
}
