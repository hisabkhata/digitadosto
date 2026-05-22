import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Bar, BarChart, Line, ComposedChart, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

type Period = "today" | "week" | "month" | "custom";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

function ReportsPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState<Period>("week");
  const [fromDate, setFromDate] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() - 6); return startOfDay(d); });
  const [toDate, setToDate] = useState<Date>(() => endOfDay(new Date()));
  const fmt = (n: number) => new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US", { maximumFractionDigits: 2 }).format(n);

  const { since, until } = useMemo(() => {
    if (period === "custom") return { since: startOfDay(fromDate), until: endOfDay(toDate) };
    const now = new Date();
    const e = endOfDay(now);
    const s = startOfDay(now);
    if (period === "week") s.setDate(s.getDate() - 6);
    if (period === "month") s.setDate(s.getDate() - 29);
    return { since: s, until: e };
  }, [period, fromDate, toDate]);

  const { data } = useQuery({
    queryKey: ["reports", user?.id, since.toISOString(), until.toISOString()],
    queryFn: async () => {
      const sIso = since.toISOString();
      const uIso = until.toISOString();
      const [salesRes, itemsRes] = await Promise.all([
        supabase.from("sales").select("total,created_at").eq("user_id", user!.id).gte("created_at", sIso).lte("created_at", uIso),
        supabase.from("sale_items").select("product_name,quantity,unit_price,cost_price,created_at").eq("user_id", user!.id).gte("created_at", sIso).lte("created_at", uIso),
      ]);
      const sales = salesRes.data ?? [];
      const items = itemsRes.data ?? [];
      const revenue = sales.reduce((s, x) => s + Number(x.total), 0);
      const cost = items.reduce((s, x) => s + Number(x.cost_price) * Number(x.quantity), 0);
      const profit = items.reduce((s, x) => s + (Number(x.unit_price) - Number(x.cost_price)) * Number(x.quantity), 0);

      // Build complete day buckets between since..until
      const byDay: Record<string, { revenue: number; cost: number; profit: number }> = {};
      const cursor = new Date(since);
      while (cursor <= until) {
        byDay[cursor.toISOString().slice(0, 10)] = { revenue: 0, cost: 0, profit: 0 };
        cursor.setDate(cursor.getDate() + 1);
      }
      sales.forEach((s) => {
        const k = new Date(s.created_at).toISOString().slice(0, 10);
        if (byDay[k]) byDay[k].revenue += Number(s.total);
      });
      items.forEach((i) => {
        const k = new Date(i.created_at).toISOString().slice(0, 10);
        if (!byDay[k]) return;
        const c = Number(i.cost_price) * Number(i.quantity);
        const p = (Number(i.unit_price) - Number(i.cost_price)) * Number(i.quantity);
        byDay[k].cost += c;
        byDay[k].profit += p;
      });
      const days = Object.entries(byDay).sort().map(([d, v]) => ({ day: d.slice(5), ...v }));

      const byProd: Record<string, { qty: number; revenue: number }> = {};
      items.forEach((i) => {
        const k = i.product_name;
        if (!byProd[k]) byProd[k] = { qty: 0, revenue: 0 };
        byProd[k].qty += Number(i.quantity);
        byProd[k].revenue += Number(i.quantity) * Number(i.unit_price);
      });
      const top = Object.entries(byProd).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);

      return { revenue, cost, profit, days, top, count: sales.length };
    },
    enabled: !!user,
  });

  const margin = data && data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0;
  const avg = data && data.count > 0 ? data.revenue / data.count : 0;

  const periods: { id: Period; label: string }[] = [
    { id: "today", label: t("today") },
    { id: "week", label: t("thisWeek") },
    { id: "month", label: t("thisMonth") },
    { id: "custom", label: t("custom") },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold md:text-3xl">{t("reports")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg border bg-card p-1">
            {periods.map((p) => (
              <button key={p.id} onClick={() => setPeriod(p.id)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${period === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {p.label}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <DateField date={fromDate} onChange={setFromDate} label={t("from")} />
              <span className="text-muted-foreground">→</span>
              <DateField date={toDate} onChange={setToDate} label={t("to")} />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label={t("revenue")} value={`৳${fmt(data?.revenue ?? 0)}`} />
        <Stat label={t("cost")} value={`৳${fmt(data?.cost ?? 0)}`} tone="muted" />
        <Stat label={t("profit")} value={`৳${fmt(data?.profit ?? 0)}`} tone="success" />
        <Stat label={t("margin")} value={`${fmt(margin)}%`} />
        <Stat label={t("avgSale")} value={`৳${fmt(avg)}`} />
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-semibold">{t("revenueVsCost")}</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data?.days ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name={t("revenue")} fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="cost" name={t("cost")} fill="var(--color-muted-foreground)" radius={[6, 6, 0, 0]} />
              <Line dataKey="profit" name={t("profit")} stroke="var(--color-success)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-semibold">{t("dailyTrend")}</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.days ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Bar dataKey="profit" name={t("profit")} fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "muted" }) {
  const color = tone === "success" ? "text-success" : tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground md:text-sm">{label}</div>
      <div className={`mt-1 text-lg font-bold md:text-xl ${color}`}>{value}</div>
    </div>
  );
}

function DateField({ date, onChange, label }: { date: Date; onChange: (d: Date) => void; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("h-9 justify-start gap-2 text-left font-normal")}>
          <CalendarIcon className="h-4 w-4 opacity-60" />
          <span className="text-xs text-muted-foreground">{label}:</span>
          <span>{format(date, "dd MMM yy")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={(d) => d && onChange(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
      </PopoverContent>
    </Popover>
  );
}
