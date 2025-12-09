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
    <div className="min-h-screen relative overflow-hidden">
      {/* Beautiful animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(215,85%,25%)] via-[hsl(215,70%,35%)] to-[hsl(142,76%,30%)]" />
      
      {/* Animated floating orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -left-20 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-20 left-1/3 w-64 h-64 bg-accent/15 rounded-full blur-3xl" />
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] bg-[size:40px_40px]" />
      </div>
      
      <header className="relative border-b border-white/10 bg-white/5 backdrop-blur-md shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">
            SAI Bank
          </h1>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white/80 hover:text-white hover:bg-white/10">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="relative container mx-auto px-4 py-8 space-y-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="md:col-span-2 bg-white/10 backdrop-blur-xl border-white/20 text-white shadow-2xl">
            <CardHeader>
              <CardDescription className="text-white/70">Account Balance</CardDescription>
              <CardTitle className="text-4xl font-bold text-white">
                ${account?.balance.toFixed(2)}
              </CardTitle>
              <p className="text-sm text-white/60">
                Account: {account?.account_number}
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button onClick={() => navigate("/send")} className="flex-1 bg-white text-primary hover:bg-white/90">
                  <Send className="h-4 w-4 mr-2" />
                  Send Money
                </Button>
                <Button variant="outline" onClick={() => navigate("/transactions")} className="flex-1 border-white/30 text-white hover:bg-white/10">
                  <History className="h-4 w-4 mr-2" />
                  History
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl border-white/20 text-white shadow-2xl">
            <CardHeader>
              <CardDescription className="text-white/70">
                Account Type
              </CardDescription>
              <CardTitle className="flex items-center gap-2 text-white">
                <CreditCard className="h-6 w-6" />
                {account?.account_type.charAt(0).toUpperCase() + account?.account_type.slice(1)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-white/70">
                Premium Banking Services
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/10 backdrop-blur-xl border-white/20 text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white">Recent Transactions</CardTitle>
            <CardDescription className="text-white/70">Your latest financial activities</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-center text-white/60 py-8">
                No transactions yet
              </p>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {transaction.type === "credit" ? (
                        <div className="p-2 rounded-full bg-emerald-500/20">
                          <ArrowDownRight className="h-5 w-5 text-emerald-400" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-full bg-red-500/20">
                          <ArrowUpRight className="h-5 w-5 text-red-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-white">
                          {transaction.description || transaction.recipient_name || "Transaction"}
                        </p>
                        <p className="text-sm text-white/60">
                          {new Date(transaction.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`font-semibold ${
                        transaction.type === "credit" ? "text-emerald-400" : "text-red-400"
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