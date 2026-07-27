import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const saleInput = z.object({
  client_id: z.string().uuid(),
  kind: z.enum(["produto", "servico", "instalacao", "desinstalacao", "manutencao"]),
  description: z.string().trim().min(1).max(300),
  amount: z.number().nonnegative().max(9_999_999),
  occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paid: z.boolean().default(false),
  payment_method: z.enum(["pix", "credito", "debito", "dinheiro", "transferencia"]).nullable().optional(),
});

export const listSales = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId?: string; from?: string; to?: string; limit?: number }) =>
    z
      .object({
        clientId: z.string().uuid().optional(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        limit: z.number().int().positive().max(500).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("sales")
      .select("id, client_id, kind, description, amount, occurred_at, paid, payment_method, created_at")
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (data.clientId) q = q.eq("client_id", data.clientId);
    if (data.from) q = q.gte("occurred_at", data.from);
    if (data.to) q = q.lte("occurred_at", data.to);
    if (data.limit) q = q.limit(data.limit);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saleInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sales")
      .insert({ ...data, owner_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleSalePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; paid: boolean }) =>
    z.object({ id: z.string().uuid(), paid: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sales")
      .update({ paid: data.paid })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sales").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
