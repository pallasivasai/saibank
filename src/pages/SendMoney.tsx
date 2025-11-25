import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send } from "lucide-react";
import { z } from "zod";

const transferSchema = z.object({
  recipientAccount: z.string().trim().min(5, "Invalid account number").max(50, "Account number too long"),
  recipientName: z.string().trim().min(2, "Name too short").max(100, "Name too long"),
  amount: z.number().positive("Amount must be positive").max(1000000, "Amount too large"),
  description: z.string().trim().max(200, "Description too long").optional(),
});

interface AvailableAccount {
  account_number: string;
  user_id: string;
  full_name: string;
}

const SendMoney = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accountId, setAccountId] = useState<string>("");
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [availableAccounts, setAvailableAccounts] = useState<AvailableAccount[]>([]);

  const [form, setForm] = useState({
    recipientAccount: "",
    recipientName: "",
    amount: "",
    description: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      fetchAccountData(session.user.id);
      fetchAvailableAccounts(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchAccountData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, balance")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      setAccountId(data.id);
      setCurrentBalance(data.balance);
    } catch (error: any) {
      console.error("Error fetching account:", error);
    }
  };

  const fetchAvailableAccounts = async (currentUserId: string) => {
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select(`
          account_number,
          user_id,
          profiles!inner(full_name)
        `)
        .neq("user_id", currentUserId);

      if (error) throw error;
      
      const formattedAccounts = (data || []).map((account: any) => ({
        account_number: account.account_number,
        user_id: account.user_id,
        full_name: account.profiles.full_name,
      }));
      
      setAvailableAccounts(formattedAccounts);
    } catch (error: any) {
      console.error("Error fetching available accounts:", error);
    }
  };

  const handleAccountSelect = (accountNumber: string) => {
    const selectedAccount = availableAccounts.find(
      (acc) => acc.account_number === accountNumber
    );
    
    if (selectedAccount) {
      setForm({
        ...form,
        recipientAccount: selectedAccount.account_number,
        recipientName: selectedAccount.full_name,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = transferSchema.parse({
        ...form,
        amount: parseFloat(form.amount),
      });

      if (validated.amount > currentBalance) {
        throw new Error("Insufficient balance");
      }

      const { error: transactionError } = await supabase.from("transactions").insert({
        account_id: accountId,
        user_id: user?.id,
        type: "debit",
        amount: validated.amount,
        recipient_account: validated.recipientAccount,
        recipient_name: validated.recipientName,
        description: validated.description || "Money transfer",
        status: "completed",
      });

      if (transactionError) throw transactionError;

      const { error: updateError } = await supabase
        .from("accounts")
        .update({ balance: currentBalance - validated.amount })
        .eq("id", accountId);

      if (updateError) throw updateError;

      toast({
        title: "Transfer successful!",
        description: `$${validated.amount.toFixed(2)} sent to ${validated.recipientName}`,
      });

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Transfer failed",
        description: error.message || "Could not complete the transfer",
        variant: "destructive",
      });
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
          <h1 className="text-2xl font-bold">Send Money</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>Transfer Funds</CardTitle>
            <CardDescription>
              Available Balance: <span className="font-semibold text-foreground">${currentBalance.toFixed(2)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="accountSelect">Select Recipient (Optional)</Label>
                <Select onValueChange={handleAccountSelect} disabled={isLoading}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Choose from existing accounts" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {availableAccounts.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No other accounts available
                      </SelectItem>
                    ) : (
                      availableAccounts.map((account) => (
                        <SelectItem key={account.account_number} value={account.account_number}>
                          {account.full_name} - {account.account_number}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Or enter account details manually below
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipientAccount">Recipient Account Number</Label>
                <Input
                  id="recipientAccount"
                  placeholder="SAI123456789"
                  value={form.recipientAccount}
                  onChange={(e) => setForm({ ...form, recipientAccount: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipientName">Recipient Name</Label>
                <Input
                  id="recipientName"
                  placeholder="John Doe"
                  value={form.recipientName}
                  onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="Payment for..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  "Processing..."
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Money
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SendMoney;