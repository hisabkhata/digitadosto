import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

type Period = "today" | "week" | "month";

function ReportsPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState<Period>("week");
  const fmt = (n: number) => new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US", { maximumFractionDigits: 2 }).format(n);

  const since = (() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    if (period === "today") return d;
    if (period === "week") { d.setDate(d.getDate() - 6); return d; }
    d.setDate(d.getDate() - 29); return d;
  })();

  const { data } = useQuery({
    queryKey: ["reports", user?.id, period],
    queryFn: async () => {
      const sinceIso = since.toISOString();
      const [salesRes, itemsRes] = await Promise.all([
        supabase.from("sales").select("total,created_at").eq("user_id", user!.id).gte("created_at", sinceIso),
        supabase.from("sale_items").select("product_name,quantity,unit_price,cost_price,created_at").eq("user_id", user!.id).gte("created_at", sinceIso),
      ]);
      const sales = salesRes.data ?? [];
      const items = itemsRes.data ?? [];
      const revenue = sales.reduce((s, x) => s + Number(x.total), 0);
      const profit = items.reduce((s, x) => s + (Number(x.unit_price) - Number(x.cost_price)) * Number(x.quantity), 0);

      // Group revenue by day
      const byDay: Record<string, number> = {};
      sales.forEach((s) => {
        const k = new Date(s.created_at).toISOString().slice(0, 10);
        byDay[k] = (byDay[k] ?? 0) + Number(s.total);
      });
      const days = Object.entries(byDay).sort().map(([d, v]) => ({ day: d.slice(5), revenue: v }));

      // Top products by qty
      const byProd: Record<string, { qty: number; revenue: number }> = {};
      items.forEach((i) => {
        const k = i.product_name;
        if (!byProd[k]) byProd[k] = { qty: 0, revenue: 0 };
        byProd[k].qty += Number(i.quantity);
        byProd[k].revenue += Number(i.quantity) * Number(i.unit_price);
      });
      const top = Object.entries(byProd).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);

      return { revenue, profit, days, top, count: sales.length };
    },
    enabled: !!user,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold md:text-3xl">{t("reports")}</h1>
        <div className="flex gap-1 rounded-lg border bg-card p-1">
          {(["today", "week", "month"] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {p === "today" ? t("today") : p === "week" ? t("thisWeek") : t("thisMonth")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-5"><div className="text-sm text-muted-foreground">{t("revenue")}</div><div className="mt-1 text-2xl font-bold">৳{fmt(data?.revenue ?? 0)}</div></div>
        <div className="rounded-xl border bg-card p-5"><div className="text-sm text-muted-foreground">{t("profit")}</div><div className="mt-1 text-2xl font-bold text-success">৳{fmt(data?.profit ?? 0)}</div></div>
        <div className="rounded-xl border bg-card p-5 col-span-2 md:col-span-1"><div className="text-sm text-muted-foreground">{t("sales")}</div><div className="mt-1 text-2xl font-bold">{fmt(data?.count ?? 0)}</div></div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-semibold">{t("revenue")}</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.days ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Bar dataKey="revenue" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-semibold">{t("topProducts")}</h2>
        {!data || data.top.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">{t("noData")}</div>
        ) : (
          <div className="divide-y">
            {data.top.map(([name, v]) => (
              <div key={name} className="flex justify-between py-2">
                <span>{name}</span>
                <span className="text-muted-foreground">{fmt(v.qty)} · <span className="font-medium text-foreground">৳{fmt(v.revenue)}</span></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
