import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCompanySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("company_settings")
      .select("name, cnpj, address, phone, email")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { name: "", cnpj: "", address: "", phone: "", email: "" };
  });

const upsertSchema = z.object({
  name: z.string().trim().max(200).default(""),
  cnpj: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(400).nullable().optional(),
  phone: z.string().trim().max(60).nullable().optional(),
  email: z.string().trim().max(200).nullable().optional(),
});

export const saveCompanySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("company_settings")
      .upsert({ owner_id: context.userId, ...data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
