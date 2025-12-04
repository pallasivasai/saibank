import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Zap, Globe, TrendingUp } from "lucide-react";
import heroImage from "@/assets/hero-banking.jpg";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session) {
        navigate("/dashboard");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-secondary opacity-90" />
          <img
            src={heroImage}
            alt="SAI Bank - secure digital banking with 30-minute payment reversing"
            className="absolute inset-0 h-full w-full object-cover mix-blend-overlay"
            loading="lazy"
          />

          <div className="relative container mx-auto flex min-h-screen flex-col px-4 py-20 lg:flex-row lg:items-center lg:gap-12 lg:py-28">
            {/* Left: Copy & CTAs */}
            <div className="flex-1 space-y-8 text-white animate-fade-in">
              <p className="inline-flex items-center gap-2 rounded-full bg-black/25 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em]">
                <span className="h-1.5 w-1.5 rounded-full bg-success pulse" />
                Industry-first 30-minute payment reversing safety window
              </p>

              <h1 className="text-balance text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                Banking Made Simple.
                <span className="block text-xl font-semibold text-primary-foreground/80 sm:text-2xl">
                  Designed for the real world of mistakes and second chances.
                </span>
              </h1>

              <p className="max-w-xl text-lg text-white/90">
                SAI Bank is the only digital bank that bakes in a
                <span className="font-semibold"> 30-minute payment reversing window</span> on eligible
                transfers. Send with confidence, knowing you can correct honest errors before they settle.
              </p>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  className="hover-scale bg-white text-primary hover:bg-white/90 text-lg px-8 shadow-elevated"
                  onClick={() => navigate("/auth")}
                >
                  Get Started in Minutes
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="hover-scale border-white/70 bg-transparent text-white hover:bg-white/10 text-lg px-8"
                  onClick={() => navigate("/auth")}
                >
                  Sign In
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-white/80">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span>Bank‑grade security & encryption</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <span>Instant transfers with safety net</span>
                </div>
              </div>
            </div>

            {/* Right: Glass dashboard preview */}
            <aside className="mt-12 flex-1 lg:mt-0">
              <div className="animate-enter relative mx-auto w-full max-w-md rounded-3xl bg-white/10 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between text-xs text-white/80">
                  <span className="rounded-full bg-black/30 px-3 py-1 font-medium">SAI Smart Account</span>
                  <span>Live preview</span>
                </div>

                <div className="mb-6 rounded-2xl bg-black/35 p-5 text-white shadow-inner">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/70">Available balance</p>
                  <p className="mt-1 text-3xl font-semibold">₹ 82,450.00</p>
                  <p className="mt-2 text-xs text-white/70">Updated in real time with every transaction.</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-white/80">
                    <span className="font-semibold">Recent transfers</span>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                      30-MIN REVERSAL ACTIVE
                    </span>
                  </div>

                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2">
                      <div>
                        <p className="font-medium">Rent payment</p>
                        <p className="text-xs text-white/70">You have 29:12 to reverse this payment</p>
                      </div>
                      <span className="text-sm font-semibold text-emerald-200">-₹ 18,500</span>
                    </li>
                    <li className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2">
                      <div>
                        <p className="font-medium">Wrong UPI transfer</p>
                        <p className="text-xs text-white/70">Reversed within 30 minutes</p>
                      </div>
                      <span className="text-sm font-semibold text-emerald-300">+₹ 2,000</span>
                    </li>
                    <li className="flex items-center justify-between rounded-xl bg-black/10 px-3 py-2">
                      <div>
                        <p className="font-medium">Utility bill</p>
                        <p className="text-xs text-white/70">Settled • Out of reversing window</p>
                      </div>
                      <span className="text-sm font-semibold text-white/80">-₹ 1,250</span>
                    </li>
                  </ul>

                  <p className="mt-3 text-[11px] text-white/70">
                    For eligible transfers, you can instantly request a reversal within 30 minutes. After the
                    window closes, payments are settled like any other bank.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* How the 30-minute payment reversing works */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <header className="mx-auto mb-10 max-w-3xl text-center">
              <h2 className="text-3xl font-bold mb-3">30-Minute Payment Reversing, Built for Modern Banking</h2>
              <p className="text-lg text-muted-foreground">
                In every tech industry, users expect room for honest mistakes. SAI Bank brings that standard to
                money movement with a clear, time-boxed 30-minute reversal window.
              </p>
            </header>

            <div className="grid gap-6 md:grid-cols-3">
              <Card className="shadow-card animate-fade-in">
                <CardHeader>
                  <div className="mb-4 w-fit rounded-full bg-primary/10 p-3">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>1. Send instantly</CardTitle>
                  <CardDescription>
                    Money moves in real time so your recipients aren&apos;t left waiting, whether it&apos;s rent,
                    salaries, or UPI transfers.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="shadow-card animate-fade-in">
                <CardHeader>
                  <div className="mb-4 w-fit rounded-full bg-secondary/10 p-3">
                    <Shield className="h-6 w-6 text-secondary" />
                  </div>
                  <CardTitle>2. 30-minute safety window</CardTitle>
                  <CardDescription>
                    If something looks wrong—wrong account, wrong amount—you have up to 30 minutes to trigger a
                    reversal request on eligible transfers.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="shadow-card animate-fade-in">
                <CardHeader>
                  <div className="mb-4 w-fit rounded-full bg-success/10 p-3">
                    <TrendingUp className="h-6 w-6 text-success" />
                  </div>
                  <CardTitle>3. Clear finality after 30 minutes</CardTitle>
                  <CardDescription>
                    After the window, payments are final and non‑recoverable—giving both sides certainty and a
                    transparent audit trail.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Secondary Features Section */}
        <section className="bg-background py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <h2 className="mb-4 text-3xl font-bold">Everything you expect from a modern digital bank</h2>
              <p className="text-lg text-muted-foreground">
                Alongside our 30-minute reversing feature, SAI Bank delivers the reliability and performance every
                tech-forward customer expects.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <Card className="shadow-card hover:shadow-elevated transition-shadow">
                <CardHeader>
                  <div className="mb-4 w-fit rounded-full bg-primary/10 p-3">
                    <Shield className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>Bank‑grade Security</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Your accounts are protected with strong encryption, device‑level checks, and continuous monitoring.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="shadow-card hover:shadow-elevated transition-shadow">
                <CardHeader>
                  <div className="mb-4 w-fit rounded-full bg-secondary/10 p-3">
                    <Zap className="h-8 w-8 text-secondary" />
                  </div>
                  <CardTitle>Instant Transfers</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Move money in real time across accounts and recipients while still enjoying the 30-minute safety net.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="shadow-card hover:shadow-elevated transition-shadow">
                <CardHeader>
                  <div className="mb-4 w-fit rounded-full bg-accent/10 p-3">
                    <Globe className="h-8 w-8 text-accent" />
                  </div>
                  <CardTitle>24/7 Access</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Bank from anywhere with always‑on access, whether you&apos;re on mobile, tablet, or desktop.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="shadow-card hover:shadow-elevated transition-shadow">
                <CardHeader>
                  <div className="mb-4 w-fit rounded-full bg-success/10 p-3">
                    <TrendingUp className="h-8 w-8 text-success" />
                  </div>
                  <CardTitle>Smart Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Track balances, recurring bills, and cash‑flow trends with clear, real‑time insights.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>
            &copy; 2026 SAI Bank. All rights reserved. Built for a tech industry that expects
            instant payments <span className="font-semibold">and</span> a fair 30-minute reversing standard.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;