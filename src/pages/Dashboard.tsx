import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowUpRight, ArrowDownRight, CreditCard, LogOut, Send, History } from "lucide-react";

interface Account {
  id: string;
  account_number: string;
  account_type: string;
  balance: number;
  currency: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
  recipient_name?: string;
  status: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchAccountData();
      fetchTransactions();
      subscribeToTransactions();
    }
  }, [user]);

  const fetchAccountData = async () => {
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      setAccount(data);
    } catch (error: any) {
      console.error("Error fetching account:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      console.error("Error fetching transactions:", error);
    }
  };

  const subscribeToTransactions = () => {
    const channel = supabase
      .channel("transactions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          setTransactions((prev) => [payload.new as Transaction, ...prev].slice(0, 5));
          fetchAccountData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You've been successfully logged out.",
    });
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            SAI Bank
          </h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="md:col-span-2 shadow-card">
            <CardHeader>
              <CardDescription>Account Balance</CardDescription>
              <CardTitle className="text-4xl font-bold">
                ${account?.balance.toFixed(2)}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Account: {account?.account_number}
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button onClick={() => navigate("/send")} className="flex-1">
                  <Send className="h-4 w-4 mr-2" />
                  Send Money
                </Button>
                <Button variant="outline" onClick={() => navigate("/transactions")} className="flex-1">
                  <History className="h-4 w-4 mr-2" />
                  History
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <CardHeader>
              <CardDescription className="text-primary-foreground/80">
                Account Type
              </CardDescription>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-6 w-6" />
                {account?.account_type.charAt(0).toUpperCase() + account?.account_type.slice(1)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-primary-foreground/80">
                Premium Banking Services
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Your latest financial activities</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No transactions yet
              </p>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {transaction.type === "credit" ? (
                        <div className="p-2 rounded-full bg-success/10">
                          <ArrowDownRight className="h-5 w-5 text-success" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-full bg-destructive/10">
                          <ArrowUpRight className="h-5 w-5 text-destructive" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">
                          {transaction.description || transaction.recipient_name || "Transaction"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(transaction.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`font-semibold ${
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

export default Dashboard;