## লক্ষ্য

একজন ছোট দোকানদারের জন্য একটি bilingual (বাংলা/English) web app — যেখানে product inventory, daily sales, customer due এবং profit report এক জায়গায় manage করা যাবে।

## মূল Features

1. **Authentication** — Email/password login (Lovable Cloud)। শুধু logged-in user নিজের data দেখবে।
2. **Product Inventory**
   - Product add/edit/delete (নাম, category, ক্রয়মূল্য, বিক্রয়মূল্য, stock quantity, unit যেমন kg/piece/litre)
   - Low stock alert
   - Search ও filter
3. **Sales Entry (POS-style)**
   - একাধিক product যোগ করে একটি sale তৈরি
   - স্বয়ংক্রিয় total, stock কমে যাওয়া
   - Customer name (optional), payment status: Paid / Due / Partial
4. **Customer Due**
   - বাকি customer-দের list
   - প্রতি customer-এর জন্য due history ও payment receive
5. **Reports**
   - আজকের / এই সপ্তাহের / এই মাসের বিক্রয়, খরচ, মুনাফা
   - Top-selling products
   - Simple chart (bar/line)
6. **Language Toggle** — বাংলা ↔ English (header-এ switch, localStorage-এ save)

## Pages / Routes

```
/login              — Login / Signup
/_authenticated/
  / (dashboard)     — আজকের summary + quick actions
  /products         — Inventory list + add/edit
  /sales            — New sale entry + recent sales
  /due              — Customer due list
  /reports          — Charts ও period filter
```

## Database (Lovable Cloud)

- `products` — id, user_id, name, category, cost_price, sale_price, stock, unit, low_stock_threshold
- `sales` — id, user_id, customer_name, total, paid_amount, status, created_at
- `sale_items` — id, sale_id, product_id, quantity, unit_price
- `due_payments` — id, sale_id, amount, paid_at

প্রতিটা table-এ RLS: শুধু `auth.uid() = user_id` row দেখা/edit করা যাবে।

## Design

Clean ও simple — সাদা background, একটি accent color (সবুজ/নীল), large readable typography (বাংলা-friendly font যেমন Hind Siliguri / Noto Sans Bengali), sidebar navigation, card-based layout। shadcn/ui components ব্যবহার হবে।

## Tech (technical section)

- TanStack Start routes + TanStack Query for data
- Supabase (Lovable Cloud) — auth + Postgres + RLS
- `createServerFn` দিয়ে data mutation, `useSuspenseQuery` দিয়ে read
- i18n: lightweight context + translation dictionary (বাংলা/English)
- Recharts for report charts

## Implementation Order

1. Lovable Cloud enable + auth setup (login/signup page, `_authenticated` guard)
2. Database schema + RLS migration
3. i18n context + language toggle
4. Products CRUD page
5. Sales entry page (with stock deduction)
6. Customer due page
7. Dashboard + reports with charts
8. Polish ও mobile responsive check

## এই plan-এ যা নেই (পরে যোগ করা যাবে)

- Multi-user / employee role
- Barcode scanning
- Print/PDF receipt
- Supplier/purchase management
- Offline mode

কাজ শুরু করার আগে এই plan-এ কিছু পরিবর্তন/যোগ চাই?