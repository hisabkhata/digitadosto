## পণ্য ফর্মে নতুন ফিচার

### ১. Category dropdown (নিজে তৈরি করার সুবিধাসহ)

ডিফল্ট demo category থাকবে:
- মুদি (Grocery)
- চাল-ডাল (Rice & Lentils)
- তেল-মসলা (Oil & Spices)
- বিস্কুট-চিপস (Snacks)
- পানীয় (Beverages)
- দুগ্ধজাত (Dairy)
- প্রসাধনী (Toiletries)
- বেকারি (Bakery)
- অন্যান্য (Others)

UI: একটি **Combobox** (search + select) — drop‑down এ demo + আগে ব্যবহৃত categories দেখাবে, উপরে টাইপ করলে filter হবে, এবং "➕ নতুন যোগ করুন: <টাইপ করা নাম>" option দেখাবে যা click করলে সেই category সিলেক্ট হয়ে যাবে। পরে নতুন product save করলে সেটা automatically future drop‑down এ আসবে (products টেবিল থেকে distinct category নিয়ে)।

### ২. পণ্যের ছবি upload

- Form এ "পণ্যের ছবি" field — file picker + preview thumbnail।
- Edit এর সময় আগের ছবি দেখাবে, replace/remove করা যাবে।
- Product list এ নামের পাশে ছোট thumbnail দেখাবে।

### Technical details

- **Storage**: নতুন public bucket `product-images` তৈরি হবে। RLS: user শুধু নিজের folder (`{user_id}/...`) এ upload/update/delete করতে পারবে; read public।
- **DB**: `products` table এ দুটি column যোগ — `image_url text null`, এবং কিছুই না (category আগেই আছে)।
- **Migration**: bucket তৈরি + storage.objects এ ৪টা policy।
- **Frontend** (`src/routes/_authenticated/products.tsx`):
  - নতুন `CategoryCombobox` component — shadcn `Command` + `Popover` ব্যবহার করে, demo list + DB থেকে আনা distinct categories merge করবে।
  - `ProductForm` এ image input: file → `supabase.storage.from('product-images').upload(...)` → URL save।
  - Product list row এ thumbnail।
- **i18n**: নতুন কী — `selectCategory`, `createCategory`, `image`, `uploadImage`, `removeImage` (বাংলা + English)।
- Demo categories একটি constant array হিসেবে i18n‑aware লেবেল সহ।

কোনো অন্য পেজ/business logic এ পরিবর্তন নেই।
