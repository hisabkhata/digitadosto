import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Package, ShoppingCart, Wallet, TrendingUp, AlertTriangle, Plus, Calendar, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format, startOfDay, startOfMonth, subDays } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const fmt = (n: number) => new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US", { maximumFractionDigits: 2 }).format(n);

  const { data } = useQuery({
    queryKey: ["dashboard-v2", user?.id],
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const monthStart = startOfMonth(new Date()).toISOString();
      const since7 = subDays(startOfDay(new Date()), 6).toISOString();
      const since30 = subDays(startOfDay(new Date()), 29).toISOString();

      const [
        todaySalesRes,
        todayItemsRes,
        monthSalesRes,
        monthItemsRes,
        productsRes,
        allDueRes,
        trendSalesRes,
        trendItemsRes,
        bestItemsRes,
        recentSalesRes,
        recentDueRes,
      ] = await Promise.all([
        supabase.from("sales").select("total").eq("user_id", user!.id).gte("created_at", todayStart),
        supabase.from("sale_items").select("quantity,unit_price,cost_price").eq("user_id", user!.id).gte("created_at", todayStart),
        supabase.from("sales").select("total").eq("user_id", user!.id).gte("created_at", monthStart),
        supabase.from("sale_items").select("quantity,unit_price,cost_price").eq("user_id", user!.id).gte("created_at", monthStart),
        supabase.from("products").select("id,name,stock,low_stock_threshold").eq("user_id", user!.id),
        supabase.from("sales").select("total,paid_amount").eq("user_id", user!.id).in("status", ["due", "partial"]),
        supabase.from("sales").select("total,created_at").eq("user_id", user!.id).gte("created_at", since7),
        supabase.from("sale_items").select("quantity,unit_price,cost_price,created_at").eq("user_id", user!.id).gte("created_at", since7),
        supabase.from("sale_items").select("product_name,quantity").eq("user_id", user!.id).gte("created_at", since30),
        supabase.from("sales").select("id,total,customer_name,created_at,status").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(6),
        supabase.from("due_payments").select("id,amount,paid_at,sale_id").eq("user_id", user!.id).order("paid_at", { ascending: false }).limit(4),
      ]);

      const todaySales = (todaySalesRes.data ?? []).reduce((s, x) => s + Number(x.total), 0);
      const todayProfit = (todayItemsRes.data ?? []).reduce((s, x) => s + (Number(x.unit_price) - Number(x.cost_price)) * Number(x.quantity), 0);
      const monthlyRevenue = (monthSalesRes.data ?? []).reduce((s, x) => s + Number(x.total), 0);
      const monthlyProfit = (monthItemsRes.data ?? []).reduce((s, x) => s + (Number(x.unit_price) - Number(x.cost_price)) * Number(x.quantity), 0);
      const totalDue = (allDueRes.data ?? []).reduce((s, x) => s + (Number(x.total) - Number(x.paid_amount)), 0);
      const products = productsRes.data ?? [];
      const lowStock = products.filter((p) => Number(p.stock) <= Number(p.low_stock_threshold));

      // 7-day trend buckets
      const days: { date: string; label: string; revenue: number; profit: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(), i);
        days.push({ date: format(d, "yyyy-MM-dd"), label: format(d, "dd/MM"), revenue: 0, profit: 0 });
      }
      const byDate = new Map(days.map((d) => [d.date, d]));
      (trendSalesRes.data ?? []).forEach((s) => {
        const k = format(new Date(s.created_at), "yyyy-MM-dd");
        const b = byDate.get(k); if (b) b.revenue += Number(s.total);
      });
      (trendItemsRes.data ?? []).forEach((it) => {
        const k = format(new Date(it.created_at), "yyyy-MM-dd");
        const b = byDate.get(k); if (b) b.profit += (Number(it.unit_price) - Number(it.cost_price)) * Number(it.quantity);
      });

      // Best sellers (last 30d)
      const bestMap = new Map<string, number>();
      (bestItemsRes.data ?? []).forEach((it) => {
        bestMap.set(it.product_name, (bestMap.get(it.product_name) ?? 0) + Number(it.quantity));
      });
      const bestSellers = [...bestMap.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);

      // Recent activity (merge sales + due payments)
      type Act = { id: string; kind: "sale" | "due"; amount: number; label: string; at: string };
      const acts: Act[] = [];
      (recentSalesRes.data ?? []).forEach((s) =>
        acts.push({ id: `s-${s.id}`, kind: "sale", amount: Number(s.total), label: s.customer_name || t("walkIn"), at: s.created_at }),
      );
      (recentDueRes.data ?? []).forEach((d) =>
        acts.push({ id: `d-${d.id}`, kind: "due", amount: Number(d.amount), label: t("duePaid"), at: d.paid_at }),
      );
      acts.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

      return {
        todaySales, todayProfit, monthlyRevenue, monthlyProfit, totalDue,
        productsCount: products.length, lowStock, trend: days, bestSellers,
        activity: acts.slice(0, 8),
      };
    },
    enabled: !!user,
  });

  const stats = [
    { label: t("todaySales"), value: data ? `৳ ${fmt(data.todaySales)}` : "…", icon: ShoppingCart, color: "bg-chart-1/15 text-chart-1" },
    { label: t("todayProfit"), value: data ? `৳ ${fmt(data.todayProfit)}` : "…", icon: TrendingUp, color: "bg-success/15 text-success" },
    { label: t("monthlyRevenue"), value: data ? `৳ ${fmt(data.monthlyRevenue)}` : "…", icon: Calendar, color: "bg-chart-3/15 text-chart-3" },
    { label: t("monthlyProfit"), value: data ? `৳ ${fmt(data.monthlyProfit)}` : "…", icon: TrendingUp, color: "bg-chart-4/15 text-chart-4" },
    { label: t("totalDue"), value: data ? `৳ ${fmt(data.totalDue)}` : "…", icon: Wallet, color: "bg-destructive/15 text-destructive" },
    { label: t("productsCount"), value: data ? fmt(data.productsCount) : "…", icon: Package, color: "bg-chart-2/15 text-chart-2" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{t("dashboard")}</h1>
          <p className="text-sm text-muted-foreground">{t("quickStats")}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/sales"><Button><Plus className="mr-1 h-4 w-4" />{t("newSale")}</Button></Link>
          <Link to="/products"><Button variant="outline"><Plus className="mr-1 h-4 w-4" />{t("addProduct")}</Button></Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 md:gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}>
              <s.icon className="h-4 w-4" />
            </div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-base font-bold md:text-lg">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <div className="rounded-xl border bg-card p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-semibold">{t("salesTrend")}</div>
            <div className="text-xs text-muted-foreground">{t("last7Days")}</div>
          </div>
        </div>
        <div className="h-56 w-full">
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} name={t("revenue")} />
                <Line type="monotone" dataKey="profit" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name={t("profit")} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Best sellers */}
        <div className="rounded-xl border bg-card p-4 md:p-5">
          <div className="mb-3 flex items-center gap-2 font-semibold">
            <TrendingUp className="h-4 w-4 text-chart-1" /> {t("bestSellers")}
            <span className="text-xs font-normal text-muted-foreground">· {t("last30Days")}</span>
          </div>
          {data && data.bestSellers.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">{t("noData")}</div>}
          <ul className="space-y-2">
            {data?.bestSellers.map((p, i) => {
              const max = data.bestSellers[0].qty || 1;
              const pct = (p.qty / max) * 100;
              return (
                <li key={p.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate"><span className="mr-2 text-muted-foreground">#{i + 1}</span>{p.name}</span>
                    <span className="font-medium tabular-nums">{fmt(p.qty)} {t("sold")}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border bg-card p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <Activity className="h-4 w-4 text-chart-2" /> {t("recentActivity")}
            </div>
            <Link to="/sales" className="text-xs text-primary hover:underline">{t("viewAll")}</Link>
          </div>
          {data && data.activity.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">{t("noData")}</div>}
          <ul className="space-y-2">
            {data?.activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-transparent bg-muted/30 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{a.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.kind === "sale" ? t("sale") : t("duePaid")} · {format(new Date(a.at), "dd MMM, HH:mm")}
                  </div>
                </div>
                <div className={`shrink-0 font-semibold tabular-nums ${a.kind === "due" ? "text-success" : ""}`}>
                  ৳ {fmt(a.amount)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {data && data.lowStock.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold text-warning-foreground">
            <AlertTriangle className="h-5 w-5 text-warning" /> {t("lowStockItems")} ({data.lowStock.length})
          </div>
          <ul className="space-y-1 text-sm">
            {data.lowStock.slice(0, 5).map((p) => (
              <li key={p.id} className="flex justify-between"><span>{p.name}</span><span className="font-medium">{fmt(Number(p.stock))}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
