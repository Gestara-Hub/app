"use client";

import { format, parseISO } from "date-fns";
import type { PlanPeriod } from "@gestarahub/contracts";

/** "2026-09-01" ou ISO completo -> "01/09/2026". */
export const brDate = (iso: string) => format(parseISO(iso), "dd/MM/yyyy");

export const PERIOD_SHORT: Record<PlanPeriod, string> = {
  monthly: "mês",
  biweekly: "quinzena",
  weekly: "semana",
};

export const TIMING_LABEL = { prepaid: "Antecipado", postpaid: "Depois do uso" } as const;
