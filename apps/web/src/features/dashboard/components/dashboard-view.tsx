"use client";

import { useModel } from "@/features/auth";
import { useOrganization, useUnit } from "@/features/settings";
import { AcademyDashboardView } from "./academy-dashboard-view";
import { SchedulingDashboardView } from "./scheduling-dashboard-view";

export function DashboardView() {
  const model = useModel();
  const orgQuery = useOrganization();
  const unitQuery = useUnit();

  const organization = orgQuery.data;
  const unit = unitQuery.data;

  const isClasses =
    model === "classes" ||
    organization?.model === "classes" ||
    organization?.segment?.toLowerCase().includes("academia") ||
    organization?.name?.toLowerCase().includes("academia") ||
    unit?.name?.toLowerCase().includes("academia");

  if (isClasses) {
    return <AcademyDashboardView />;
  }

  return <SchedulingDashboardView />;
}
