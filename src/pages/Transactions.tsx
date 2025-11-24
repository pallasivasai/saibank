import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
  recipient_name?: string;
  recipient_account?: string;
  status: string;
}

const Transactions = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
                {transactions.map((transaction) => (
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
                    <p
                      className={`font-semibold text-lg ${
                        transaction.type === "credit" ? "text-success" : "text-destructive"
                      }`}
                    >
                      {transaction.type === "credit" ? "+" : "-"}${transaction.amount.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Transactions;