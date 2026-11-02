# 🚀 Supabase Setup & Launch Guide for Mudra

We have completely transitioned the Mudra platform to **Supabase**. Your project credentials have already been configured into `mudra/.env`.

---

## Step 1: Run the Database Schema in Supabase

1. Open your Supabase Dashboard: [https://supabase.com/dashboard/project/iwxznhslzdyykpguefjm](https://supabase.com/dashboard/project/iwxznhslzdyykpguefjm)
2. On the left sidebar, click **SQL Editor** (icon with `>_` or SQL terminal).
3. Click **New query** (top left).
4. Copy and paste the entire contents of [`mudra/supabase_schema.sql`](file:///c:/Users/Swast/OneDrive/Desktop/venture%20verse%20mudra/mudra/supabase_schema.sql) into the editor.
5. Click the green **Run** button (or press `Ctrl + Enter`).

*(This creates all tables: `profiles`, `stocks`, `holdings`, `trades`, `news`, and `event_config`, configures RLS security rules, and activates Realtime subscriptions).*

---

## Step 2: Disable Email Confirmations (Recommended for smooth student signup)

1. In Supabase Dashboard, go to **Authentication** (left sidebar).
2. Click **Providers** → expand **Email**.
3. Toggle **Confirm email** to **OFF** (so students can immediately log in without waiting for confirmation emails).
4. Click **Save**.

---

## Step 3: Start the Mudra Platform

In your PowerShell / terminal:
```powershell
cd "c:\Users\Swast\OneDrive\Desktop\venture verse mudra\mudra"
npm run dev
```
Open [http://localhost:5173](http://localhost:5173).

---

## Step 4: Create Admin Account & Initialize

1. Go to `http://localhost:5173/register` and sign up with your admin email and password.
2. Go to **Supabase Dashboard** → **Table Editor** → click `profiles`.
3. Find your user row and change `role` from `'student'` to `'admin'`.
4. Refresh your browser or go to `http://localhost:5173/admin`.
5. Under the **Setup** tab:
   - Click **Seed All 30 Stocks →** (seeds all 30 companies into Supabase).
   - Set the 7-day event duration.
6. Click **Start 30s** to turn on the automated price engine!
