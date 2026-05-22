import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/due")({ component: DuePage });

function DuePage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const fmt = (n: number) => new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US", { maximumFractionDigits: 2 }).format(n);

  const { data: dues = [] } = useQuery({
    queryKey: ["dues", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("sales").select("id,customer_name,customer_phone,total,paid_amount,status,created_at")
        .eq("user_id", user!.id).in("status", ["due", "partial"]).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const [selected, setSelected] = useState<any>(null);
  const [amount, setAmount] = useState("");

  const receive = async () => {
    if (!selected) return;
    const a = Number(amount);
    if (!a || a <= 0) return;
    const newPaid = Number(selected.paid_amount) + a;
    const newStatus = newPaid >= Number(selected.total) ? "paid" : "partial";
    const { error: e1 } = await supabase.from("due_payments").insert({
      sale_id: selected.id, user_id: user!.id, amount: a,
    });
    if (e1) { toast.error(e1.message); return; }
    const { error: e2 } = await supabase.from("sales").update({ paid_amount: newPaid, status: newStatus }).eq("id", selected.id);
    if (e2) { toast.error(e2.message); return; }
    toast.success(t("saved"));
    setSelected(null); setAmount("");
    qc.invalidateQueries({ queryKey: ["dues"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const totalDue = dues.reduce((s: number, x: any) => s + (Number(x.total) - Number(x.paid_amount)), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold md:text-3xl">{t("due")}</h1>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">{t("totalDue")}</div>
          <div className="text-xl font-bold text-destructive">৳{fmt(totalDue)}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {dues.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">{t("noData")}</div>
        ) : (
          <div className="divide-y">
            {dues.map((d: any) => {
              const remaining = Number(d.total) - Number(d.paid_amount);
              return (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{d.customer_name || t("walkIn")}</div>
                    {d.customer_phone && <div className="text-xs text-muted-foreground">{d.customer_phone}</div>}
                    <div className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">{t("remaining")}</div>
                    <div className="font-bold text-destructive">৳{fmt(remaining)}</div>
                    <div className="text-xs text-muted-foreground">{t("paid")} ৳{fmt(Number(d.paid_amount))} / ৳{fmt(Number(d.total))}</div>
                  </div>
                  <Button size="sm" onClick={() => { setSelected(d); setAmount(""); }}>{t("receivePayment")}</Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("receivePayment")}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div>{selected.customer_name || t("walkIn")}</div>
                <div className="text-muted-foreground">{t("remaining")}: ৳{fmt(Number(selected.total) - Number(selected.paid_amount))}</div>
              </div>
              <div><Label>{t("amount")}</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("enterAmount")} autoFocus /></div>
              <Button className="w-full" onClick={receive}>{t("save")}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
