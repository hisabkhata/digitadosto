import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n, type TKey } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Pencil, Trash2, Search, AlertTriangle, ChevronsUpDown, Check, Upload, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/products")({ component: ProductsPage });

type Product = {
  id: string; name: string; category: string | null;
  cost_price: number; sale_price: number; stock: number;
  unit: string; low_stock_threshold: number; image_url: string | null;
};

const DEMO_CATEGORY_KEYS: TKey[] = [
  "catGrocery", "catRice", "catOilSpice", "catSnacks", "catBeverage",
  "catDairy", "catToiletries", "catBakery", "catOthers",
];

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
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? t("edit") : t("addProduct")}</DialogTitle></DialogHeader>
            <ProductForm editing={editing} products={products} onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["products"] }); }} />
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
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      {low && <AlertTriangle className="h-4 w-4 text-warning" />}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {p.category && <span>{p.category} · </span>}
                      {t("stock")}: {fmt(Number(p.stock))} {(t as (k: string) => string)(p.unit) ?? p.unit} · ৳{fmt(Number(p.sale_price))}
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

function CategoryCombobox({ value, onChange, products }: { value: string; onChange: (v: string) => void; products: Product[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const demo = DEMO_CATEGORY_KEYS.map((k) => t(k));
    const used = Array.from(new Set(products.map((p) => p.category).filter((c): c is string => !!c && c.trim() !== "")));
    return Array.from(new Set([...demo, ...used])).sort((a, b) => a.localeCompare(b));
  }, [products, t]);

  const trimmed = query.trim();
  const exists = trimmed && options.some((o) => o.toLowerCase() === trimmed.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className={cn(!value && "text-muted-foreground")}>{value || t("selectCategory")}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput placeholder={t("searchCategory")} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>—</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem key={opt} value={opt} onSelect={() => { onChange(opt); setOpen(false); setQuery(""); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")} />
                  {opt}
                </CommandItem>
              ))}
              {trimmed && !exists && (
                <CommandItem value={`__create__${trimmed}`} onSelect={() => { onChange(trimmed); setOpen(false); setQuery(""); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("createCategory")}: <span className="ml-1 font-medium">{trimmed}</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false, contentType: file.type });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  };

  return (
    <div>
      <Label>{t("image")}</Label>
      <div className="mt-1 flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" />
            {uploading ? t("uploading") : t("uploadImage")}
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
              <X className="mr-1 h-4 w-4" />{t("removeImage")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductForm({ editing, products, onDone }: { editing: Product | null; products: Product[]; onDone: () => void }) {
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
    image_url: editing?.image_url ?? "",
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
      image_url: form.image_url.trim() || null,
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
      <div>
        <Label>{t("category")}</Label>
        <CategoryCombobox value={form.category} onChange={(v) => set("category", v)} products={products} />
      </div>
      <ImageField value={form.image_url} onChange={(v) => set("image_url", v)} />
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
