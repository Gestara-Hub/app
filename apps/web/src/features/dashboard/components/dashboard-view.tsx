"use client";

import { useModel } from "@/features/auth";
import { AcademyDashboardView } from "./academy-dashboard-view";
import { SchedulingDashboardView } from "./scheduling-dashboard-view";

export function DashboardView() {
  const model = useModel();

  if (model === "classes") {
    return <AcademyDashboardView />;
  }

  return <SchedulingDashboardView />;
}
