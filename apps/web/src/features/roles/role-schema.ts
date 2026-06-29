import { z } from "zod";

export const roleFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do cargo."),
});

export type RoleFormValues = z.infer<typeof roleFormSchema>;
