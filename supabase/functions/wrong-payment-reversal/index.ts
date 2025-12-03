import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables", {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
    });
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;

  if (!token) {
    return new Response(JSON.stringify({ error: "unauthorized", message: "Missing access token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      console.error("Error fetching user from token", userError);
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;

    const body = await req.json().catch((err) => {
      console.error("Invalid JSON body", err);
      return null;
    });

    if (!body || !body.transactionId) {
      return new Response(JSON.stringify({ error: "bad_request", message: "Missing transactionId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transactionId = body.transactionId as string;
    console.log("Reversal requested for transaction", transactionId, "by user", user.id);

    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (txError || !transaction) {
      console.error("Transaction not found or error", txError);
      return new Response(JSON.stringify({ error: "not_found", message: "Transaction not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (transaction.user_id !== user.id) {
      console.warn("User tried to reverse transaction they do not own", {
        userId: user.id,
        ownerId: transaction.user_id,
      });
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (transaction.type !== "debit") {
      return new Response(JSON.stringify({ error: "invalid_transaction_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const createdAt = new Date(transaction.created_at).getTime();
    const now = Date.now();
    const fifteenMinutesMs = 15 * 60 * 1000;

    if (now - createdAt > fifteenMinutesMs) {
      console.log("Reversal window expired for transaction", transactionId);
      return new Response(
        JSON.stringify({
          error: "time_window_passed",
          message: "This payment can no longer be reversed (over 15 minutes).",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const reversalDescription = `WRONG_PAYMENT_REVERSAL:${transaction.id}`;

    const { data: existingReversals, error: existingError } = await supabase
      .from("transactions")
      .select("id")
      .eq("description", reversalDescription)
      .limit(1);

    if (existingError) {
      console.error("Error checking existing reversals", existingError);
      return new Response(JSON.stringify({ error: "server_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingReversals && existingReversals.length > 0) {
      return new Response(
        JSON.stringify({ error: "already_reversed", message: "This payment has already been reversed." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", transaction.account_id)
      .single();

    if (accountError || !account) {
      console.error("Error fetching account for transaction", accountError);
      return new Response(JSON.stringify({ error: "account_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (account.user_id !== user.id) {
      console.warn("Account for transaction does not belong to user", {
        userId: user.id,
        accountUserId: account.user_id,
      });
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentBalance = Number(account.balance);
    const amount = Number(transaction.amount);
    const newBalance = currentBalance + amount;

    const { error: updateError } = await supabase
      .from("accounts")
      .update({ balance: newBalance })
      .eq("id", account.id);

    if (updateError) {
      console.error("Error updating account balance during reversal", updateError);
      return new Response(JSON.stringify({ error: "update_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabase.from("transactions").insert({
      account_id: account.id,
      user_id: user.id,
      type: "credit",
      amount: transaction.amount,
      recipient_account: transaction.recipient_account,
      recipient_name: transaction.recipient_name,
      description: reversalDescription,
      status: "completed",
    });

    if (insertError) {
      console.error("Error inserting reversal transaction", insertError);
      return new Response(JSON.stringify({ error: "insert_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Reversal completed for transaction", transactionId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error handling reversal request", error);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
