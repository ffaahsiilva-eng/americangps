import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function rangeFor(range: "week" | "month") {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const start = new Date(now);
  if (range === "week") start.setDate(start.getDate() - 6);
  else start.setDate(start.getDate() - 29);
  return { from: start.toISOString().slice(0, 10), to };
}

export const getCashSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { range: "week" | "month" }) =>
    z.object({ range: z.enum(["week", "month"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { from, to } = rangeFor(data.range);
    const { data: rows, error } = await context.supabase
      .from("sales")
      .select("kind, amount, paid, client_id, occurred_at")
      .gte("occurred_at", from)
      .lte("occurred_at", to);
    if (error) throw new Error(error.message);

    let total = 0;
    let produto = 0;
    let servico = 0;
    let pago = 0;
    let aberto = 0;
    const clientSet = new Set<string>();
    for (const r of rows ?? []) {
      const a = Number(r.amount);
      total += a;
      if (r.kind === "produto") produto += a;
      else servico += a;
      if (r.paid) pago += a;
      else aberto += a;
      clientSet.add(r.client_id);
    }
    return {
      from,
      to,
      total,
      produto,
      servico,
      pago,
      aberto,
      clients: clientSet.size,
      count: rows?.length ?? 0,
    };
  });

export const getMonthlyClosing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; month: string }) =>
    z
      .object({
        clientId: z.string().uuid(),
        month: z.string().regex(/^\d{4}-\d{2}$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const [y, m] = data.month.split("-").map(Number);
    const from = `${data.month}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${data.month}-${String(lastDay).padStart(2, "0")}`;

    const [{ data: client, error: cErr }, { data: rows, error: sErr }, { data: company }, { data: invoiceNumber, error: invErr }] = await Promise.all([
      context.supabase
        .from("clients")
        .select("id, name, email, phone")
        .eq("id", data.clientId)
        .maybeSingle(),
      context.supabase
        .from("sales")
        .select("id, kind, description, amount, occurred_at, paid")
        .eq("client_id", data.clientId)
        .gte("occurred_at", from)
        .lte("occurred_at", to)
        .order("occurred_at", { ascending: true }),
      context.supabase
        .from("company_settings")
        .select("name, cnpj, address, phone, email")
        .eq("owner_id", context.userId)
        .maybeSingle(),
      context.supabase.rpc("get_or_create_closing", {
        _client_id: data.clientId,
        _month: data.month,
      }),
    ]);
    if (cErr) throw new Error(cErr.message);
    if (sErr) throw new Error(sErr.message);
    if (invErr) throw new Error(invErr.message);
    if (!client) throw new Error("Cliente não encontrado");

    const items = rows ?? [];
    let total = 0;
    let pago = 0;
    for (const r of items) {
      const a = Number(r.amount);
      total += a;
      if (r.paid) pago += a;
    }
    return {
      client,
      company: company ?? null,
      invoiceNumber: (invoiceNumber as number | null) ?? 0,
      month: data.month,
      from,
      to,
      items,
      total,
      pago,
      aberto: total - pago,
    };
  });
