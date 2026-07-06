"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Badge";

export default function SetupPage() {
  const [name, setName] = useState("GRX Transportes");
  const [tradeName, setTradeName] = useState("GRX");
  const [document, setDocument] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Usuário não autenticado.");
      setLoading(false);
      return;
    }

    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .insert({ name, trade_name: tradeName, document: document || null })
      .select()
      .single();

    if (companyErr) {
      setError(companyErr.message);
      setLoading(false);
      return;
    }

    const { error: memberErr } = await supabase.from("company_members").insert({
      company_id: company.id,
      user_id: user.id,
      role: "admin",
    });

    if (memberErr) {
      setError(memberErr.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader
          title="Configurar empresa"
          description="Primeiro acesso — cadastre a empresa GRX"
        />
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert variant="error">{error}</Alert>}
            <Input label="Razão social" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Nome fantasia" value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
            <Input label="CNPJ" value={document} onChange={(e) => setDocument(e.target.value)} />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Criando..." : "Criar empresa e continuar"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
