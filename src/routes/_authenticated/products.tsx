import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/products")({ component: ProductsPage });

type Product = {
  id: string; name: string; category: string | null;
  cost_price: number; sale_price: number; stock: number;
  unit: string; low_stock_threshold: number;
};

function ProductsPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("user_id", user!.id).order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
    enabled: !!user,
  });

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || (p.category ?? "").toLowerCase().includes(search.toLowerCase()));
  const fmt = (n: number) => new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US", { maximumFractionDigits: 2 }).format(n);

  const remove = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success(t("saved")); qc.invalidateQueries({ queryKey: ["products"] }); }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold md:text-3xl">{t("products")}</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />{t("addProduct")}</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing ? t("edit") : t("addProduct")}</DialogTitle></DialogHeader>
            <ProductForm editing={editing} onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["products"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {isLoading ? (
          <div className="p-6 text-center text-muted-foreground">…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">{t("noData")}</div>
        ) : (
          <div className="divide-y">
            {filtered.map((p) => {
              const low = Number(p.stock) <= Number(p.low_stock_threshold);
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      {low && <AlertTriangle className="h-4 w-4 text-warning" />}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {p.category && <span>{p.category} · </span>}
                      {t("stock")}: {fmt(Number(p.stock))} {t(p.unit as any) ?? p.unit} · ৳{fmt(Number(p.sale_price))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductForm({ editing, onDone }: { editing: Product | null; onDone: () => void }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    category: editing?.category ?? "",
    cost_price: editing ? String(editing.cost_price) : "",
    sale_price: editing ? String(editing.sale_price) : "",
    stock: editing ? String(editing.stock) : "0",
    unit: editing?.unit ?? "piece",
    low_stock_threshold: editing ? String(editing.low_stock_threshold) : "5",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      user_id: user!.id,
      name: form.name.trim(),
      category: form.category.trim() || null,
      cost_price: Number(form.cost_price) || 0,
      sale_price: Number(form.sale_price) || 0,
      stock: Number(form.stock) || 0,
      unit: form.unit,
      low_stock_threshold: Number(form.low_stock_threshold) || 0,
    };
    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success(t("saved")); onDone(); }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>{t("productName")}</Label><Input required value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
      <div><Label>{t("category")}</Label><Input value={form.category} onChange={(e) => set("category", e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>{t("costPrice")}</Label><Input type="number" step="0.01" value={form.cost_price} onChange={(e) => set("cost_price", e.target.value)} /></div>
        <div><Label>{t("salePrice")}</Label><Input type="number" step="0.01" required value={form.sale_price} onChange={(e) => set("sale_price", e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>{t("stock")}</Label><Input type="number" step="0.01" value={form.stock} onChange={(e) => set("stock", e.target.value)} /></div>
        <div>
          <Label>{t("unit")}</Label>
          <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="piece">{t("piece")}</SelectItem>
              <SelectItem value="kg">{t("kg")}</SelectItem>
              <SelectItem value="litre">{t("litre")}</SelectItem>
              <SelectItem value="packet">{t("packet")}</SelectItem>
              <SelectItem value="dozen">{t("dozen")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>{t("lowStockAlert")}</Label><Input type="number" step="0.01" value={form.low_stock_threshold} onChange={(e) => set("low_stock_threshold", e.target.value)} /></div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "…" : t("save")}</Button>
    </form>
  );
}
