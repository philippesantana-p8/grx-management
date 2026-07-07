"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/brand/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Badge";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const next = searchParams.get("next") || "/dashboard";

    if (isSignUp) {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) setError(err.message);
      else setError("Conta criada! Verifique seu e-mail ou faça login.");
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
      else {
        router.push(next);
        router.refresh();
      }
    }
    setLoading(false);
  };

  return (
    <Card className="w-full max-w-md border-slate-200 shadow-md">
      <CardHeader
        title={isSignUp ? "Criar conta" : "Entrar"}
        description="Acesse sua conta para continuar"
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant={error.includes("criada") ? "info" : "error"}>{error}</Alert>}
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Aguarde..." : isSignUp ? "Criar conta" : "Entrar"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-brand-600 hover:text-brand-700 hover:underline"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? "Já tenho conta" : "Criar nova conta"}
          </button>
        </form>
      </CardBody>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="text-sm text-slate-500">Carregando...</div>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
