import { z } from "zod";

export const appointmentFormSchema = z.object({
  clientId: z.string().min(1, "Selecione um cliente."),
  professionalId: z.string().min(1, "Selecione um profissional."),
  serviceIds: z.array(z.string()).min(1, "Selecione ao menos um serviço."),
  date: z.string().min(1, "Selecione a data."),
  start: z.string().min(1, "Selecione o horário."),
  notes: z.string().optional(),
});

export type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;
