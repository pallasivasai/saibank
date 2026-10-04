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
  - Transfer is processed through the database `transfer_money()` function, which debits the sender and credits the recipient while creating linked ledger entries.

- **Transaction History** (`/transactions`)
  - Full list of the user’s transactions (credits & debits).  
  - Clear visual indicators for **incoming (credit)** vs **outgoing (debit)** payments.  
  - Shows description, recipient details, status, amount, and timestamp.  
  - For eligible debits, shows an **“Oops, wrong payment”** button.

- **Payment Reversing**
  - The current application UI exposes the **“Oops, wrong payment”** recovery action for eligible outbound **debit** transactions.  
  - The database recovery procedure implements a **24‑hour recovery window**.
  - A recovery can:
    1. Verify the authenticated user owns the transaction.
    2. Verify the original transaction is an outgoing `debit`.
    3. Check that it has not already been reversed.
    4. Enforce the 24‑hour limit using `created_at`.
    5. Debit the recipient by the original amount.
    6. Credit the sender by the original amount.
    7. Mark linked transaction records as reversed.
    8. Insert compensating reversal ledger entries.
  - When the recipient has already withdrawn the funds, the recipient balance can become negative and the database trigger freezes that account.

---

## Why Payment Reversing Matters

A time‑boxed error‑correction workflow demonstrates how a banking system can keep transfers fast while still giving users a controlled recovery path.

This project demonstrates:

- **User safety** – structured recovery for mistaken outgoing payments.
- **Database integrity** – sender and recipient balances are updated together through database logic.
- **Transaction traceability** – related records are connected with `transfer_group`.
- **Negative‑balance handling** – a recovery can safely represent a recipient who already spent the funds.
- **Account controls** – negative balances trigger an automatic freeze until the balance is cleared.
- **Auditability** – original records are marked reversed and compensating entries are recorded.

---

## 📸 Live Project Evidence

The following screenshots show the actual working transaction and recovery flow.

### Transaction History — Reversed Payment
![SAI Bank Transaction History – Reversed Payment](https://saibank.lovable.app/transactions)

> The transaction history demonstrates a debit marked as reversed and a compensating credit showing that the amount was restored.

### Reversal Window — Eligible Payment
![SAI Bank Reversal Window](https://saibank.lovable.app/transactions)

> An eligible debit displays **“Oops, wrong payment”** together with the remaining recovery time in the live application.

### Dashboard — Transaction Ledger
![SAI Bank Dashboard Transactions](https://saibank.lovable.app/dashboard)

> The dashboard shows recent outgoing and incoming ledger activity, including reversal-related entries.

> **Repository:** https://github.com/pallasivasai/saibank  
> **Live app:** https://saibank.lovable.app/

---

## 🗄️ Database Design Architecture

The project is database‑first: the UI calls database procedures, balances are maintained in the `accounts` table, and financial history is recorded in the `transactions` ledger.

### Schema Relationship Diagram

```text
                    AUTH.USERS
                        |
                        | 1 : 1
                        v
                    PROFILES
                 (id, name, phone)
                        |
                        | 1 : many
                        v
                     ACCOUNTS
        +--------------------------------------+
        | id                                   |
        | user_id -> profiles.id               |
        | account_number                       |
        | account_type                         |
        | balance                              |
        | currency                             |
        | is_frozen / frozen_reason            |
        +------------------+-------------------+
                           |
                           | 1 : many
                           v
                    TRANSACTIONS
        +--------------------------------------+
        | id                                   |
        | account_id -> accounts.id            |
        | user_id -> profiles.id               |
        | type = debit / credit / transfer     |
        | amount                               |
        | recipient_account                    |
        | recipient_name                       |
        | description                          |
        | status                               |
        | transfer_group                       |
        | is_reversal                          |
        | reversed_at                          |
        | created_at                           |
        +--------------------------------------+
```

**Important database relationship:** `transfer_group` logically links the sender and recipient ledger entries belonging to the same transfer. It is not a separate physical `transfers` table in the current schema.

### Database Logic Flow

```
                USER
                 |
                 v
       React / TypeScript UI
                 |
                 v
        Supabase RPC Layer
                 |
        +--------+---------+
        |                  |
        v                  v
 transfer_money()   reverse_transaction()
        |                  |
        v                  v
    POSTGRESQL DATABASE / LEDGER
        |
        +--> accounts
        +--> profiles
        +--> transactions
        +--> triggers / RLS
```

---

## 🔄 Transfer Processing Architecture

```
User selects recipient + amount
             |
             v
      transfer_money()
             |
             +--> auth.uid()
             |
             +--> Lock sender row
             |
             +--> Check frozen status
             |
             +--> Check sufficient balance
             |
             +--> Lock recipient row
             |
             +--> Prevent self-transfer
             |
             +--> Sender balance -= amount
             |
             +--> Recipient balance += amount
             |
             +--> Insert sender DEBIT
             |
             +--> Insert recipient CREDIT
             |
             +--> Same transfer_group links both
             |
             v
       Transaction Ledger
```

The database procedure uses `FOR UPDATE` row locking for sender and recipient accounts, so the transfer logic is designed around consistent account updates and linked ledger records.

---

## ↩️ Wrong-Payment Recovery Architecture

```
User clicks "Oops, wrong payment"
              |
              v
     reverse_transaction()
              |
              +--> Authenticate caller
              |
              +--> Find owned DEBIT
              |
              +--> Reject if already reversed
              |
              +--> Enforce 24-hour window
              |
              +--> Lock sender account
              |
              +--> Lock recipient account
              |
              +--> Debit recipient
              |       |
              |       +--> Enough balance
              |       |       -> recipient stays >= 0
              |       |
              |       +--> Insufficient balance
              |               -> recipient becomes negative
              |                        |
              |                        v
              |                account freeze trigger
              |
              +--> Credit sender
              |
              +--> Mark original transfer REVERSED
              |
              +--> Mark linked recipient credit REVERSED
              |
              +--> Insert sender reversal CREDIT
              |
              +--> Insert recipient reversal DEBIT
              |
              v
          Updated Ledger
```

---

## 🧪 Case Studies

### Case Study 1 — Recipient Still Has Enough Money

**Scenario:** A sender transfers **$15,000** by mistake. The recipient still has enough balance when the sender requests recovery.

```
BEFORE TRANSFER
Sender:    $20,000
Recipient: $20,000

TRANSFER
Sender  ---------------- $15,000 ----------------> Recipient

AFTER TRANSFER
Sender:    $5,000
Recipient: $35,000

AFTER RECOVERY
Sender:    $20,000
Recipient: $20,000
```

**Database result**

- Sender original debit → `status = reversed`
- Recipient original credit → `status = reversed`
- Sender receives a reversal `credit`
- Recipient receives a reversal `debit`
- `transfer_group` keeps the related entries traceable

---

### Case Study 2 — Recipient Already Withdrew / Spent the Money

**Scenario:** The sender requests recovery after the recipient has already spent or withdrawn the transferred funds.

```
BEFORE TRANSFER
Sender:    $20,000
Recipient: $20,000

AFTER $15,000 TRANSFER
Sender:    $5,000
Recipient: $35,000

Recipient spends / withdraws $30,000
Sender:    $5,000
Recipient: $5,000

RECOVERY REQUEST
Sender receives the original $15,000 back
Recipient balance becomes:

$5,000 - $15,000 = -$10,000
```

### Negative-Balance Recovery Logic

```
Recipient balance
      |
      v
$5,000 - $15,000
      |
      v
   -$10,000
      |
      v
BEFORE UPDATE trigger
      |
      v
is_frozen = true
frozen_reason = negative balance after recovery
      |
      v
Recipient cannot send money
      |
      v
Future incoming money clears deficit
      |
      v
Balance >= $0
      |
      v
Freeze removed
```

This is an important database case because the system does **not** need to pretend the money is still available in the recipient account. Instead, the recovery is represented explicitly through a negative balance plus an account-control state.

---

### Case Study 3 — Recovery Window Expired

```
TRANSACTION CREATED
       |
       v
0h ----------- recovery allowed ----------- 24h
                                                   |
                                                   v
                                      recovery rejected
```

The current database procedure rejects recovery when `now() - created_at > INTERVAL '24 hours'`.

---

## 🛡️ Database Security & Integrity Controls

| Control | Implementation in project |
|---|---|
| Authentication | `auth.uid()` identifies the caller |
| Row-Level Security | RLS policies protect profiles, accounts and transactions |
| Ownership validation | Recovery checks the transaction and sender account owner |
| Row locking | `FOR UPDATE` locks sender and recipient rows |
| Balance validation | Rejects non-positive amounts and insufficient sender funds |
| Self-transfer protection | Prevents sending money to the same account |
| Recovery window | 24-hour database-side time check |
| Duplicate recovery protection | `reversed_at` + `is_reversal` |
| Transfer linkage | `transfer_group` |
| Negative balance handling | Trigger freezes a negative recipient account |
| Audit trail | Reversed source records + compensating ledger entries |

---

## Architecture Overview

**Frontend**
- Vite + React + TypeScript
- Tailwind CSS for utility‑first styling
- shadcn‑ui components (Buttons, Cards, Inputs, Select, etc.)
- Custom pages:
  - `src/pages/Index.tsx` – marketing / landing (“Banking Made Simple”)
  - `src/pages/Auth.tsx` – authentication UI
  - `src/pages/Dashboard.tsx` – main account overview
  - `src/pages/SendMoney.tsx` – money transfer form with recipient dropdown
  - `src/pages/Transactions.tsx` – full history + reversal action

**Backend (Lovable Cloud)**
- Managed Postgres database with these main tables:
  - `accounts` – one or more accounts per user (balance, account number, type, freeze state)
  - `profiles` – user profile metadata (full name, phone)
  - `transactions` – ledger of debits and credits for each user/account
- Row‑Level Security (RLS) for authenticated data access.
- Auto‑generated TypeScript types in `src/integrations/supabase/types.ts`.

**Database Functions**
- `transfer_money()` performs atomic sender/recipient balance updates and inserts linked debit/credit ledger entries.
- `reverse_transaction()` performs 24-hour wrong-payment recovery, marks linked records reversed, restores the sender, and can freeze a recipient whose balance becomes negative.

---

## Key Files to Explore

- **Landing & marketing:** `src/pages/Index.tsx`
- **Send money UX:** `src/pages/SendMoney.tsx`
- **Transaction history:** `src/pages/Transactions.tsx`
- **Database schema:** `supabase/migrations/20251124144103_42d0ffa9-ef97-4422-863c-ed276f9c8fcb.sql`
- **Transfer & recovery SQL:** `drizzle/migrations/0000_transfer_and_24h_reversal_with_freeze.sql`
- **Reversed status migration:** `drizzle/migrations/0001_allow_reversed_status.sql`
- **Legacy edge function:** `supabase/functions/wrong-payment-reversal/index.ts`

---

## Running the Project Locally

> These steps apply if you’ve cloned the repository to work in your own environment. If you’re using Lovable directly, you can simply open the project in the browser and use the built‑in editor.

### Prerequisites

- Node.js and npm installed (Node 18+ recommended)
- nvm is also supported: https://github.com/nvm-sh/nvm#installing-and-updating

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/pallasivasai/saibank.git
cd saibank

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev

# 4. Open the app
# Vite will print a local URL, usually http://localhost:5173
```

### Environment Variables

When running inside Lovable Cloud, environment variables are already configured.

For external local development, configure:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## Deploying

If you’re using Lovable:

1. Open the project in Lovable.
2. Click **Share → Publish**.
3. Frontend changes go live after you click **Update** in the publish dialog.
4. Database / backend changes are deployed through the project backend.

You can optionally connect a custom domain under **Project → Settings → Domains**.

---

## Project Links

- **GitHub:** https://github.com/pallasivasai/saibank
- **Live application:** https://saibank.lovable.app/
- **Transaction history:** https://saibank.lovable.app/transactions
