# SAI Bank – Secure Digital Banking with 30‑Minute Payment Protection

SAI Bank is a demo digital‑banking web app built with React, Vite, TypeScript, Tailwind CSS, and shadcn‑ui. It showcases secure account management, real‑time transfers, and a **30‑minute payment reversing safety window** for mistaken transfers.

---

## Core Features

- **Modern onboarding & auth**  
  Email‑based sign up / sign in with persistent sessions.

- **Responsive dashboard**  
  - Shows current account balance and basic account info  
  - Lists the most recent transactions  
  - Navigation to **Send Money** and **Transaction History**

- **Send Money flow** (`/send`)
  - Select a recipient from existing customers via **"Select Recipient (Optional)"** dropdown (shows profile name + account number).  
  - Or manually enter **recipient account number** and **recipient name**.  
  - Enter **amount** and optional **description**.  
  - Client‑side validation with Zod.  
  - Creates a `debit` transaction and updates the sender’s account balance.

- **Transaction History** (`/transactions`)
  - Full list of the user’s transactions (credits & debits).  
  - Clear visual indicators for **incoming (credit)** vs **outgoing (debit)** payments.  
  - Shows description, recipient details, status, amount, and timestamp.  
  - For eligible debits, shows an **“Oops, wrong payment”** button.

- **30‑Minute Payment Reversing**
  - For outbound **debit** transactions:
    - Within **30 minutes** of creation, a button **“Oops, wrong payment”** appears in the Transactions list.
    - When clicked, it calls a backend function that:
      1. Verifies the user owns the transaction and account.  
      2. Checks the transaction is a `debit`.  
      3. Enforces a strict **30‑minute limit** based on the original `created_at` timestamp.  
      4. Updates the account balance by re‑crediting the amount.  
      5. Inserts a compensating `credit` transaction (tagged as a reversal).
    - After 30 minutes, the button disappears and a label shows:  
      _“Not recoverable (30 min window passed)”_.

---

## Why 30‑Minute Payment Reversing Matters

In real‑world fintech systems, **short error‑correction windows** are critical for:

- **User trust & safety** – People occasionally send money to the wrong person or wrong amount. A 30‑minute window offers a clear, predictable way to self‑correct without opening a formal dispute.
- **Reduced support load** – Many “wrong payment” tickets can be resolved by customers directly in‑app instead of manual back‑office intervention.
- **Compliance & auditability** – Explicit reversal flows with well‑defined time limits and clear transaction records make it easier to explain system behavior to auditors and stakeholders.
- **Better UX than hard irreversibility** – Instant transfers stay fast, but mistakes within the 30‑minute window can still be fixed in a controlled, auditable way.

This project demonstrates how a **time‑boxed reversal mechanism** can be implemented end‑to‑end: UI affordance, backend validation, and proper accounting entries.

---

## Architecture Overview

**Frontend**
- Vite + React + TypeScript
- Tailwind CSS for utility‑first styling
- shadcn‑ui components (Buttons, Cards, Inputs, Select, etc.)
- Custom pages:
  - `src/pages/Index.tsx` – marketing / landing (“Banking Made Simple”), highlights the 30‑minute safety window
  - `src/pages/Auth.tsx` – authentication UI
  - `src/pages/Dashboard.tsx` – main account overview
  - `src/pages/SendMoney.tsx` – money transfer form with recipient dropdown
  - `src/pages/Transactions.tsx` – full history + "Oops, wrong payment" reversal action

**Backend (Lovable Cloud)**
- Managed Postgres database with these main tables:
  - `accounts` – one or more accounts per user (balance, account number, type)
  - `profiles` – user profile metadata (full name, phone)
  - `transactions` – ledger of debits and credits for each user/account
- Row‑Level Security (RLS) to ensure users only interact with their own data where appropriate.
- Auto‑generated TypeScript types in `src/integrations/supabase/types.ts`.

**Edge Function for Payment Reversing**
- `supabase/functions/wrong-payment-reversal/index.ts` implements the 30‑minute reversal logic:
  - Authenticates the caller using the bearer token.
  - Fetches the target transaction and validates:
    - Ownership (`transaction.user_id === currentUserId`)
    - Type is `debit`
    - `now - created_at <= 30 minutes`
  - Checks that a reversal has not already been created (via a special description marker).  
  - Updates the `accounts` table to credit the amount back.  
  - Inserts a new `credit` transaction to record the reversal.

The Transactions page calls this edge function using `supabase.functions.invoke("wrong-payment-reversal", { body: { transactionId } })`.

---

## Running the Project Locally

> These steps apply if you’ve cloned the repository to work in your own environment. If you’re using Lovable directly, you can simply open the project in the browser and use the built‑in editor.

### Prerequisites

- Node.js and npm installed (Node 18+ recommended)  
  You can install via [nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

### Setup

```bash
# 1. Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev

# 4. Open the app
# Vite will print a local URL, usually http://localhost:5173
```

### Environment Variables

When running inside Lovable Cloud, environment variables (backend URL, keys, etc.) are already configured.  
If you want to run this project fully outside Lovable, you’ll need a compatible backend and to configure at least:

- `VITE_SUPABASE_URL` – URL of your backend project
- `VITE_SUPABASE_PUBLISHABLE_KEY` – public client key

These are read by `src/integrations/supabase/client.ts` to create the client used throughout the app.

---

## Key Files to Explore

- **Landing & marketing:** `src/pages/Index.tsx`  
  Highlights instant transfers and the 30‑minute payment protection window.

- **Send money UX:** `src/pages/SendMoney.tsx`  
  Validates input, lets users select recipients, and records debit transactions.

- **Reversal UX:** `src/pages/Transactions.tsx`  
  Shows history and exposes the **“Oops, wrong payment”** action for eligible debits. The label changes when the 30‑minute window has passed.

- **Reversal logic (backend):** `supabase/functions/wrong-payment-reversal/index.ts`  
  Guards reversal with ownership, type, and 30‑minute time checks; updates balances and creates compensating transactions.

---

## Deploying

If you’re using Lovable:

1. Open the project in Lovable.  
2. Click **Share → Publish**.  
3. Frontend changes go live after you click **Update** in the publish dialog. Backend changes (database, edge functions) deploy automatically.

You can optionally connect a custom domain under **Project → Settings → Domains**.
