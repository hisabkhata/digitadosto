# Smart Store OS — Expansion Plan

বর্তমান stack (TanStack Start + Tailwind + shadcn + Supabase + TypeScript) এ চারটি বড় feature add করব। Scope বড়, তাই **৪ phase** এ ভাগ করছি — প্রতিটা phase আলাদাভাবে ship হবে যাতে অ্যাপ যেকোনো সময় ব্যবহারযোগ্য থাকে।

---

## Phase 1 — Enhanced Dashboard

বর্তমান dashboard এ আছে: today sales, today profit, total due, products count, low stock. যোগ হবে:

- **Monthly revenue** card (এই মাসের total sales)
- **Best selling products** — top 5 (last 30 days, quantity sold)
- **Recent activity** feed — last 10 sales / due payments / expenses
- ছোট **trend chart** (last 7 days sales + profit) — recharts দিয়ে
- Date range filter (today / 7d / 30d / this month)

কোনো নতুন table লাগবে না — existing `sales` / `sale_items` থেকে aggregate।

## Phase 2 — Expense Tracking

নতুন table:
- **expenses** — `id, user_id, amount, category, note, expense_date, created_at` + RLS (user_id = auth.uid)

নতুন route: `/expenses` — list + add/edit/delete dialog, category dropdown (ভাড়া, বিদ্যুৎ, বেতন, পরিবহন, অন্যান্য + custom)।

Dashboard ও Reports এ:
- **Net profit** = (sale profit) − (expenses) — formula update
- নতুন "Today expense" / "Monthly expense" cards
- Reports এ expense breakdown chart

Sidebar এ "খরচ" nav item যোগ।

## Phase 3 — Invoice / PDF Receipt

প্রতিটা sale এর জন্য printable invoice:
- নতুন route `/sales/$saleId` — full invoice view (shop info, customer, items table, total, paid, due, footer)
- "Print" button (browser print, A5/thermal-friendly CSS)
- "Download PDF" button — jsPDF + html2canvas client-side
- "WhatsApp share" link (`https://wa.me/...?text=...`) যদি customer phone থাকে

নতুন table:
- **shop_profile** — `user_id (PK), shop_name, address, phone, logo_url` — invoice header এর জন্য
- Settings/Profile page এ shop info edit form

## Phase 4 — Employee management + Role-based login

এটাই সবচেয়ে বড় কাজ — multi-tenant org model।

নতুন tables:
- **organizations** — `id, owner_id, name, created_at`
- **organization_members** — `id, org_id, user_id, role ('owner'|'manager'|'seller'), invited_email, status, created_at` — unique (org_id, user_id)
- **app_role** enum + `user_roles` table + **`has_role(user_id, org_id, role)`** security-definer function (RLS recursion এড়ানোর জন্য)

Schema migration — **existing** `products`, `sales`, `sale_items`, `due_payments`, `expenses` সব table এ `org_id` column যোগ + RLS rewrite: `org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())`। প্রতিটা existing user এর জন্য default org auto-create করে data migrate।

`sales` এ `seller_id uuid` যোগ — কে বিক্রি করল track করার জন্য।

নতুন route: `/team`
- Owner/Manager: member list, invite by email (creates pending row), role change, remove
- নতুন signup এ email matched হলে auto-join org
- Employee performance widget: প্রতি seller এর last 30d sales/profit

Layout permission gating — seller শুধু Sales + Products দেখবে, Owner/Manager সব।

---

## Technical details

- **Stack:** TanStack Start, Supabase, shadcn/ui, Recharts (already installed), jsPDF + html2canvas (নতুন install — phase 3)
- **Bilingual:** প্রতিটা নতুন string `src/lib/i18n.tsx` এ Bangla + English
- **Mobile-first:** existing bottom-nav pattern অনুসরণ করব; sidebar এ "খরচ" ও "টিম" যোগ
- **RLS:** phase 4 এ recursion এড়াতে security-definer function pattern (knowledge base এর mandatory pattern)
- **Backwards-compatible migrations:** phase 4 এ default org auto-create করে existing data migrate, কোনো user data হারাবে না

---

## যেভাবে এগোব

আমি **Phase 1 (Enhanced Dashboard)** দিয়ে শুরু করব এই plan approve করলে — দ্রুত visible improvement, কোনো breaking change নেই। তারপর প্রতিটা phase আলাদা approval এ ship করব।

Approve করলে Phase 1 এ লেগে যাচ্ছি। অন্য কোনো phase আগে চাইলে বলুন।
