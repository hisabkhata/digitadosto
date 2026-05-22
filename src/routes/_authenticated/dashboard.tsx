import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Package, ShoppingCart, Wallet, TrendingUp, AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function Dashboard() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const fmt = (n: number) => new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US", { maximumFractionDigits: 2 }).format(n);

  const { data } = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: async () => {
      const since = startOfToday();
      const [salesRes, itemsRes, productsRes, allSalesRes] = await Promise.all([
        supabase.from("sales").select("id,total,paid_amount,status").eq("user_id", user!.id).gte("created_at", since),
        supabase.from("sale_items").select("quantity,unit_price,cost_price,sale_id").eq("user_id", user!.id).gte("created_at", since),
        supabase.from("products").select("id,name,stock,low_stock_threshold").eq("user_id", user!.id),
        supabase.from("sales").select("total,paid_amount").eq("user_id", user!.id).in("status", ["due", "partial"]),
      ]);
      const todaySales = (salesRes.data ?? []).reduce((s, x) => s + Number(x.total), 0);
      const todayProfit = (itemsRes.data ?? []).reduce((s, x) => s + (Number(x.unit_price) - Number(x.cost_price)) * Number(x.quantity), 0);
      const totalDue = (allSalesRes.data ?? []).reduce((s, x) => s + (Number(x.total) - Number(x.paid_amount)), 0);
      const products = productsRes.data ?? [];
      const lowStock = products.filter((p) => Number(p.stock) <= Number(p.low_stock_threshold));
      return { todaySales, todayProfit, totalDue, productsCount: products.length, lowStock };
    },
    enabled: !!user,
  });

  const stats = [
    { label: t("todaySales"), value: data ? `৳ ${fmt(data.todaySales)}` : "…", icon: ShoppingCart, color: "bg-chart-1/15 text-chart-1" },
    { label: t("todayProfit"), value: data ? `৳ ${fmt(data.todayProfit)}` : "…", icon: TrendingUp, color: "bg-success/15 text-success" },
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4 md:p-5">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div className="text-xs text-muted-foreground md:text-sm">{s.label}</div>
            <div className="mt-1 text-lg font-bold md:text-2xl">{s.value}</div>
          </div>
        ))}
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
