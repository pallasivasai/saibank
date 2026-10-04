# SAI Bank – Secure Digital Banking with 24‑Hour Payment Protection

SAI Bank is a demo digital‑banking web app built with React, Vite, TypeScript, Tailwind CSS, and shadcn‑ui. It showcases secure account management, real‑time transfers, and a **24‑hour database-controlled payment recovery window** for mistaken transfers.

---

## Core Features

- **Modern onboarding & auth**  
  Email‑based sign up / sign in with persistent sessions.

- **Responsive dashboard**  
  - Shows current account balance and basic account info
  - Lists the most recent transactions
  - Navigation to **Send Money** and **Transaction History**

- **Send Money flow** (`/send`)
  - Select a recipient from existing customers via **"Select Recipient (Optional)"** dropdown.
  - Or manually enter **recipient account number** and **recipient name**.
  - Enter **amount** and optional **description**.
  - Client‑side validation with Zod.
  - Transfer is processed through the database `transfer_money()` function, which debits the sender, credits the recipient, and creates linked ledger entries.

- **Transaction History** (`/transactions`)
  - Full list of the user’s transactions.
  - Clear visual indicators for incoming credits and outgoing debits.
  - Shows description, recipient details, status, amount, and timestamp.
  - Eligible debits expose **“Oops, wrong payment”**.

- **24‑Hour Payment Recovery**
  - The database recovery procedure allows eligible outgoing payments to be reversed within **24 hours**.
  - It authenticates the caller, verifies ownership, checks the debit and recovery state, locks both accounts, pulls the amount back from the recipient, restores the sender, and records compensating ledger entries.
  - If the recipient no longer has enough funds, the recipient can enter a negative balance and the database trigger automatically freezes that account.

---

## 📸 Live Project Evidence

The screenshots below document the actual working UI shown by the live SAI Bank application.

### Transaction History — Reversed Payment

> **Live screen:** [Open Transaction History](https://saibank.lovable.app/transactions)

The screen demonstrates the original payment marked **reversed** and the separate **“Wrong payment reversed - amount restored”** credit entry.

### Reversal Window — Eligible Payment

> **Live screen:** [Open Reversal Window](https://saibank.lovable.app/transactions)

The eligible debit displays **“Oops, wrong payment”** and the remaining recovery time.

### Dashboard — Transaction Ledger

> **Live screen:** [Open Dashboard](https://saibank.lovable.app/dashboard)

The dashboard displays recent debit/credit activity, including reversal-related ledger entries.

---

## 🗄️ Database Design Architecture

The implementation is database-first: account balances live in `accounts`, transaction history lives in `transactions`, and the main transfer/recovery rules execute inside PostgreSQL functions and triggers.

### Entity Relationship Diagram

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "owns"
    PROFILES ||--o{ ACCOUNTS : "has"
    ACCOUNTS ||--o{ TRANSACTIONS : "records"

    PROFILES {
        uuid id PK
        text full_name
        text phone
        timestamptz created_at
        timestamptz updated_at
    }

    ACCOUNTS {
        uuid id PK
        uuid user_id FK
        text account_number UK
        text account_type
        numeric balance
        text currency
        boolean is_frozen
        text frozen_reason
        timestamptz created_at
        timestamptz updated_at
    }

    TRANSACTIONS {
        uuid id PK
        uuid account_id FK
        uuid user_id FK
        text type
        numeric amount
        text recipient_account
        text recipient_name
        text description
        text status
        uuid transfer_group
        boolean is_reversal
        timestamptz reversed_at
        timestamptz created_at
    }
```

**Database relationship:** `transfer_group` logically connects the sender debit and recipient credit belonging to one transfer. It is not a separate physical `transfers` table.

### Database Layer Architecture

```mermaid
flowchart TB
    UI["React + TypeScript UI"]
    RPC["PostgreSQL SECURITY DEFINER Functions"]

    subgraph DB["PostgreSQL / Supabase Database"]
        A["accounts"]
        P["profiles"]
        T["transactions"]
        TR["Triggers"]
        RLS["Row-Level Security"]
    end

    UI --> RPC
    RPC --> A
    RPC --> T
    RPC --> P
    A --> TR
    P --> RLS
    A --> RLS
    T --> RLS
```

---

## 🔄 Transfer Processing Architecture

```mermaid
flowchart LR
    INPUT["Recipient + Amount"]
    AUTH["Authenticate"]
    LOCK["Lock Sender + Recipient"]
    VALID["Validate Balance / Freeze / Self-transfer"]
    UPDATE["Atomic Balance Update"]
    LEDGER["Create Debit + Credit"]
    LINK["transfer_group"]
    DONE["Completed Transfer"]

    INPUT --> AUTH --> LOCK --> VALID --> UPDATE --> LEDGER --> LINK --> DONE
```

### Database Transaction Model

```mermaid
flowchart TB
    subgraph S["Sender Account"]
        SB["Balance"]
        SD["Debit Transaction"]
    end

    subgraph R["Recipient Account"]
        RB["Balance"]
        RC["Credit Transaction"]
    end

    TG["Shared transfer_group"]

    SB -->|"- amount"| SD
    RB -->|"+ amount"| RC
    SD --- TG
    RC --- TG
```

This is backed by `transfer_money()`, which uses `FOR UPDATE` row locks and performs the sender/recipient balance changes plus ledger inserts as one database operation.

---

## ↩️ Wrong-Payment Recovery Architecture

```mermaid
flowchart TB
    REQUEST["Oops, wrong payment"]
    AUTH2["Authenticate + Verify Ownership"]
    CHECK["Check Debit + Not Reversed + 24h Window"]
    LOCK2["Lock Sender + Recipient"]
    PULL["Recipient Balance − Original Amount"]
    RESTORE["Sender Balance + Original Amount"]
    REVERSE["Mark Original Linked Entries Reversed"]
    LEDGER2["Insert Reversal Credit + Reversal Debit"]
    FREEZE{"Recipient balance < 0?"}
    FREEZE_Y["Freeze Recipient Account"]
    SAFE["Recipient remains active"]

    REQUEST --> AUTH2 --> CHECK --> LOCK2 --> PULL
    PULL --> RESTORE
    RESTORE --> REVERSE --> LEDGER2 --> FREEZE
    FREEZE -->|Yes| FREEZE_Y
    FREEZE -->|No| SAFE
```

---

## 🧪 Case Studies

### Case Study 1 — Recipient Still Has Enough Money

**Scenario:** Sender transfers **$15,000** by mistake and requests recovery while the recipient still has enough money.

```mermaid
flowchart LR
    subgraph BEFORE["Before Transfer"]
        B1["Sender $20,000"]
        B2["Recipient $20,000"]
    end

    subgraph AFTER_SEND["After $15,000 Transfer"]
        C1["Sender $5,000"]
        C2["Recipient $35,000"]
    end

    subgraph AFTER_REVERSAL["After Recovery"]
        D1["Sender $20,000"]
        D2["Recipient $20,000"]
    end

    B1 -->|"$15,000"| C2
    B2 --- C2
    C1 -->|"$15,000 restored"| D1
    C2 -->|"$15,000 returned"| D2
```

**Database result**

- Original sender debit → `status = reversed`
- Original recipient credit → `status = reversed`
- Sender gets a compensating `credit`
- Recipient gets a compensating `debit`
- `transfer_group` keeps all related entries traceable

---

### Case Study 2 — Recipient Already Withdrew / Spent the Money

**Scenario:** The recipient has already spent or withdrawn enough money that the original amount is no longer available.

```mermaid
flowchart TB
    T1["Original Transfer<br/>Sender $20,000 → Recipient $20,000"]
    T2["After $15,000 Transfer<br/>Sender $5,000 • Recipient $35,000"]
    T3["Recipient spends / withdraws $30,000<br/>Recipient $5,000"]
    T4["Recovery Requested<br/>Sender restored to $20,000"]
    T5["Recipient: $5,000 − $15,000 = −$10,000"]
    T6["Negative Balance Trigger"]
    T7["is_frozen = true<br/>frozen_reason recorded"]
    T8["Future Incoming Money"]
    T9["Balance ≥ $0"]
    T10["Freeze Automatically Cleared"]

    T1 --> T2 --> T3 --> T4 --> T5 --> T6 --> T7 --> T8 --> T9 --> T10
```

### Why This Database Case Matters

The database does not pretend that the recipient still owns money that has already been spent. Instead:

1. Sender is restored immediately.
2. Recipient balance records the recovery deficit.
3. Negative balance automatically sets `is_frozen = true`.
4. Sending is restricted while the deficit exists.
5. Future incoming funds can clear the deficit.
6. The trigger removes the freeze once the balance is non-negative.

---

### Case Study 3 — Recovery Window Expired

```mermaid
flowchart LR
    CREATED["Transaction Created"]
    ACTIVE["0–24 Hours<br/>Recovery Eligible"]
    EXPIRED["After 24 Hours<br/>Recovery Rejected"]

    CREATED --> ACTIVE --> EXPIRED
```

The database procedure rejects recovery when:

``now() - created_at > INTERVAL '24 hours'``

---

## 🛡️ Database Security & Integrity Controls

| Control | Implementation |
|---|---|
| Authentication | `auth.uid()` identifies the caller |
| Row-Level Security | RLS protects authenticated data access |
| Ownership validation | Recovery checks transaction/account ownership |
| Row locking | `FOR UPDATE` locks sender and recipient rows |
| Balance validation | Rejects non-positive amounts and insufficient sender funds |
| Self-transfer protection | Prevents sending to the same account |
| Recovery window | Database-side 24-hour check |
| Duplicate recovery protection | `reversed_at` + `is_reversal` |
| Transfer linkage | `transfer_group` |
| Negative balance handling | Trigger freezes negative recipient accounts |
| Audit trail | Reversed source records + compensating ledger entries |

---

## Architecture Overview

**Frontend**
- Vite + React + TypeScript
- Tailwind CSS
- shadcn-ui
- `src/pages/SendMoney.tsx`
- `src/pages/Transactions.tsx`
- `src/pages/Dashboard.tsx`

**Backend**
- Supabase / PostgreSQL
- `accounts`
- `profiles`
- `transactions`
- PostgreSQL functions
- PostgreSQL triggers
- Row-Level Security

**Database Functions**
- `transfer_money()` — atomic sender/recipient transfer and ledger creation.
- `reverse_transaction()` — 24-hour recovery, linked transaction reversal, sender restoration, and recipient negative-balance handling.

---

## Key Files to Explore

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
git clone https://github.com/pallasivasai/saibank.git
cd saibank
npm install
npm run dev
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

---

## Project Links

- **GitHub:** https://github.com/pallasivasai/saibank
- **Live application:** https://saibank.lovable.app/
- **Transaction history:** https://saibank.lovable.app/transactions
