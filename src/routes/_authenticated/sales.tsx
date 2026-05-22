import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sales")({ component: SalesPage });

type Product = { id: string; name: string; sale_price: number; cost_price: number; stock: number; unit: string };
type CartItem = { product_id: string; product_name: string; quantity: number; unit_price: number; cost_price: number };

function SalesPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const fmt = (n: number) => new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US", { maximumFractionDigits: 2 }).format(n);

  const { data: products = [] } = useQuery({
    queryKey: ["products", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id,name,sale_price,cost_price,stock,unit").eq("user_id", user!.id).order("name");
      return (data ?? []) as Product[];
    },
    enabled: !!user,
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["recent-sales", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("sales").select("id,customer_name,total,paid_amount,status,created_at").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
    enabled: !!user,
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selProduct, setSelProduct] = useState("");
  const [qty, setQty] = useState("1");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [paid, setPaid] = useState("");
  const [busy, setBusy] = useState(false);

  const total = cart.reduce((s, c) => s + c.quantity * c.unit_price, 0);
  const paidNum = paid === "" ? total : Number(paid);
  const status = paidNum >= total ? "paid" : paidNum > 0 ? "partial" : "due";

  const addToCart = () => {
    const p = products.find((x) => x.id === selProduct);
    if (!p) return;
    const q = Number(qty);
    if (!q || q <= 0) return;
    if (q > Number(p.stock)) { toast.error(t("stockShort")); return; }
    setCart((c) => [...c, { product_id: p.id, product_name: p.name, quantity: q, unit_price: Number(p.sale_price), cost_price: Number(p.cost_price) }]);
    setSelProduct(""); setQty("1");
  };

  const removeItem = (i: number) => setCart((c) => c.filter((_, idx) => idx !== i));

  const complete = async () => {
    if (cart.length === 0) return;
    setBusy(true);
    try {
      const { data: sale, error: sErr } = await supabase.from("sales").insert({
        user_id: user!.id,
        customer_name: customer.trim() || null,
        customer_phone: phone.trim() || null,
        total, paid_amount: paidNum, status,
      }).select("id").single();
      if (sErr) throw sErr;

      const { error: iErr } = await supabase.from("sale_items").insert(
        cart.map((c) => ({ ...c, sale_id: sale!.id, user_id: user!.id }))
      );
      if (iErr) throw iErr;

      // Deduct stock
      for (const c of cart) {
        const p = products.find((x) => x.id === c.product_id);
        if (!p) continue;
        await supabase.from("products").update({ stock: Number(p.stock) - c.quantity }).eq("id", c.product_id);
      }

      toast.success(t("saved"));
      setCart([]); setCustomer(""); setPhone(""); setPaid("");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["recent-sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-bold md:text-3xl">{t("newSale")}</h1>

      {products.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="mb-3 text-muted-foreground">{t("addFirstProduct")}</p>
          <Link to="/products"><Button>{t("addProduct")}</Button></Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-xl border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_100px_auto]">
                <div>
                  <Label>{t("selectProduct")}</Label>
                  <Select value={selProduct} onValueChange={setSelProduct}>
                    <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} (৳{fmt(Number(p.sale_price))}, {t("stock")}: {fmt(Number(p.stock))})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t("quantity")}</Label><Input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
                <div className="flex items-end"><Button onClick={addToCart} className="w-full"><Plus className="h-4 w-4" /></Button></div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card">
              {cart.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">{t("noData")}</div>
              ) : (
                <div className="divide-y">
                  {cart.map((c, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{c.product_name}</div>
                        <div className="text-xs text-muted-foreground">{fmt(c.quantity)} × ৳{fmt(c.unit_price)}</div>
                      </div>
                      <div className="font-semibold">৳{fmt(c.quantity * c.unit_price)}</div>
                      <Button size="icon" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border bg-card p-4">
            <div><Label>{t("customerName")}</Label><Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder={t("walkIn")} /></div>
            <div><Label>{t("customerPhone")}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="flex justify-between border-t pt-3 text-lg"><span>{t("total")}</span><span className="font-bold">৳{fmt(total)}</span></div>
            <div><Label>{t("paid")}</Label><Input type="number" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={String(total)} /></div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("paymentStatus")}</span>
              <span className={`font-semibold ${status === "paid" ? "text-success" : status === "partial" ? "text-warning" : "text-destructive"}`}>
                {status === "paid" ? t("fullPaid") : status === "partial" ? t("partial") : t("onDue")}
              </span>
            </div>
            <Button className="w-full" disabled={cart.length === 0 || busy} onClick={complete}>{busy ? "…" : t("completeSale")}</Button>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 mt-6 text-lg font-semibold">{t("recentSales")}</h2>
        <div className="overflow-hidden rounded-xl border bg-card">
          {recent.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">{t("noData")}</div>
          ) : (
            <div className="divide-y">
              {recent.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-3">
                  <div>
                    <div className="font-medium">{s.customer_name || t("walkIn")}</div>
                    <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-US")}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">৳{fmt(Number(s.total))}</div>
                    <div className={`text-xs ${s.status === "paid" ? "text-success" : s.status === "partial" ? "text-warning" : "text-destructive"}`}>
                      {s.status === "paid" ? t("fullPaid") : s.status === "partial" ? t("partial") : t("onDue")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
