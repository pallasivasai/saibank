import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
  recipient_name?: string;
  recipient_account?: string;
  status: string;
  reversed_at?: string | null;
  is_reversal?: boolean;
}

const Transactions = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [reversingId, setReversingId] = useState<string | null>(null);

  const REVERSAL_WINDOW_MS = 24 * 60 * 60 * 1000;

  const isWithinReversalWindow = (createdAt: string) => {
    return Date.now() - new Date(createdAt).getTime() <= REVERSAL_WINDOW_MS;
  };

  const timeLeftLabel = (createdAt: string) => {
    const msLeft = REVERSAL_WINDOW_MS - (Date.now() - new Date(createdAt).getTime());
    if (msLeft <= 0) return "";
    const hours = Math.floor(msLeft / (60 * 60 * 1000));
    const minutes = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
    return hours > 0 ? `${hours}h ${minutes}m left to reverse` : `${minutes}m left to reverse`;
  };

  const handleReversePayment = async (transaction: Transaction) => {
    setReversingId(transaction.id);
    try {
      const { data, error } = await supabase.rpc("reverse_transaction", {
        p_transaction_id: transaction.id,
      });

      if (error) throw new Error(error.message);

      const result = (data ?? {}) as { recipient_frozen?: boolean };

      toast({
        title: "Payment reversed",
        description: result.recipient_frozen
          ? "The amount is back in your account. The receiver had already withdrawn it, so their account is now negative and frozen until it is cleared."
          : "The amount has been restored to your account.",
      });

      if (user) fetchTransactions(user.id);
    } catch (error: any) {
      console.error("Error reversing transaction:", error);
      toast({
        title: "Reversal failed",
        description: error?.message || "Could not reverse this payment.",
        variant: "destructive",
      });
    } finally {
      setReversingId(null);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      fetchTransactions(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchTransactions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      console.error("Error fetching transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Transaction History</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading transactions...</p>
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No transactions yet
              </p>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction) => {
                  const isDebit = transaction.type === "debit";
                  const withinWindow = isWithinReversalWindow(transaction.created_at);
                  const isReversible =
                    isDebit &&
                    !transaction.is_reversal &&
                    !transaction.reversed_at &&
                    withinWindow;

                  return (
                    <div
                      key={transaction.id}
                      className="flex items-start justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-3 flex-1">
                        {transaction.type === "credit" ? (
                          <div className="p-2 rounded-full bg-success/10 mt-1">
                            <ArrowDownRight className="h-5 w-5 text-success" />
                          </div>
                        ) : (
                          <div className="p-2 rounded-full bg-destructive/10 mt-1">
                            <ArrowUpRight className="h-5 w-5 text-destructive" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium">
                            {transaction.description || transaction.recipient_name || "Transaction"}
                          </p>
                          {transaction.recipient_name && (
                            <p className="text-sm text-muted-foreground">
                              To: {transaction.recipient_name}
                            </p>
                          )}
                          {transaction.recipient_account && (
                            <p className="text-sm text-muted-foreground">
                              Account: {transaction.recipient_account}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-muted-foreground">
                              {new Date(transaction.created_at).toLocaleString()}
                            </p>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                transaction.status === "completed"
                                  ? "bg-success/10 text-success"
                                  : transaction.status === "pending"
                                  ? "bg-yellow-500/10 text-yellow-600"
                                  : "bg-destructive/10 text-destructive"
                              }`}
                            >
                              {transaction.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p
                          className={`font-semibold text-lg ${
                            transaction.type === "credit" ? "text-success" : "text-destructive"
                          }`}
                        >
                          {transaction.type === "credit" ? "+" : "-"}${transaction.amount.toFixed(2)}
                        </p>
                        {isReversible && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReversePayment(transaction)}
                              disabled={reversingId === transaction.id}
                            >
                              {reversingId === transaction.id ? "Reversing..." : "Oops, wrong payment"}
                            </Button>
                            <p className="text-xs text-muted-foreground">
                              {timeLeftLabel(transaction.created_at)}
                            </p>
                          </>
                        )}
                        {isDebit && !transaction.is_reversal && transaction.reversed_at && (
                          <p className="text-xs text-success">Reversed - amount restored</p>
                        )}
                        {isDebit && !transaction.is_reversal && !transaction.reversed_at && !withinWindow && (
                          <p className="text-xs text-muted-foreground">
                            Not recoverable (24 hour window passed)
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Transactions;