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
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-secondary opacity-90"></div>
        <img 
          src={heroImage} 
          alt="SAI Bank - Secure Digital Banking" 
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay"
        />
        <div className="relative container mx-auto px-4 py-24 lg:py-32">
          <div className="max-w-3xl mx-auto text-center text-white space-y-8">
            <h1 className="text-5xl lg:text-7xl font-bold leading-tight">
              Banking Made Simple
            </h1>
            <p className="text-xl lg:text-2xl text-white/90">
              Experience secure, real-time banking with SAI Bank. Your trusted financial partner for the digital age.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-white text-primary hover:bg-white/90 text-lg px-8 shadow-elevated"
                onClick={() => navigate("/auth")}
              >
                Get Started
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white text-white hover:bg-white/10 text-lg px-8"
                onClick={() => navigate("/auth")}
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why Choose SAI Bank?</h2>
            <p className="text-xl text-muted-foreground">
              Modern banking solutions designed for your convenience
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="shadow-card hover:shadow-elevated transition-shadow">
              <CardHeader>
                <div className="p-3 rounded-full bg-primary/10 w-fit mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>Bank-Grade Security</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Your money and data are protected with industry-leading encryption and security measures.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-elevated transition-shadow">
              <CardHeader>
                <div className="p-3 rounded-full bg-secondary/10 w-fit mb-4">
                  <Zap className="h-8 w-8 text-secondary" />
                </div>
                <CardTitle>Instant Transfers</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Send and receive money in real-time with our lightning-fast payment system.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-elevated transition-shadow">
              <CardHeader>
                <div className="p-3 rounded-full bg-accent/10 w-fit mb-4">
                  <Globe className="h-8 w-8 text-accent" />
                </div>
                <CardTitle>24/7 Access</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Bank anytime, anywhere with our always-available online platform.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-elevated transition-shadow">
              <CardHeader>
                <div className="p-3 rounded-full bg-success/10 w-fit mb-4">
                  <TrendingUp className="h-8 w-8 text-success" />
                </div>
                <CardTitle>Smart Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Track your spending with detailed transaction history and insights.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary to-secondary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Start Banking Smarter?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied customers who trust SAI Bank for their financial needs.
          </p>
          <Button 
            size="lg" 
            className="bg-white text-primary hover:bg-white/90 text-lg px-8 shadow-elevated"
            onClick={() => navigate("/auth")}
          >
            Open Your Account Today
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 SAI Bank. All rights reserved. Your trusted banking partner.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;