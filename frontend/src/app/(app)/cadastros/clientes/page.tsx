"use client";

import { CrudPage } from "@/components/crud/CrudPage";
import { EntityForm, FormFields } from "@/components/crud/EntityForm";
import { Badge } from "@/components/ui/Badge";
import { nextCode } from "@/lib/codes";
import { useCompany } from "@/lib/company-context";
import type { Client } from "@/types/database";
import { STATUS_OPTIONS } from "@/types/database";

export default function ClientesPage() {
  const { companyId } = useCompany();

  return (
    <CrudPage<Client>
      title="Clientes"
      description="Quem gera receita — substitui digitação livre no controle financeiro"
      table="clients"
      orderBy="name"
      columns={[
        { key: "code", label: "Código" },
        { key: "name", label: "Nome" },
        { key: "document", label: "CNPJ/CPF" },
        { key: "city", label: "Cidade" },
        {
          key: "status",
          label: "Status",
          render: (r) => (
            <Badge variant={r.status === "Ativo" ? "success" : "default"}>{r.status}</Badge>
          ),
        },
      ]}
      renderForm={({ item, onSave, onCancel, saving }) => (
        <EntityForm
          saving={saving}
          onCancel={onCancel}
          initial={{
            code: item?.code ?? "",
            name: item?.name ?? "",
            document: item?.document ?? "",
            contact_name: item?.contact_name ?? "",
            phone: item?.phone ?? "",
            city: item?.city ?? "",
            status: item?.status ?? "Ativo",
            notes: item?.notes ?? "",
          }}
          onSubmit={async (data) => {
            if (!item?.id && companyId && !data.code) {
              data.code = await nextCode("clients", companyId, "CLI");
            }
            await onSave(data);
          }}
        >
          {({ form, set }) => (
            <FormFields
              form={form}
              set={set}
              fields={[
                { name: "code", label: "Código", required: true },
                { name: "name", label: "Nome", required: true },
                { name: "document", label: "CNPJ/CPF" },
                { name: "contact_name", label: "Contato" },
                { name: "phone", label: "Telefone" },
                { name: "city", label: "Cidade" },
                {
                  name: "status",
                  label: "Status",
                  type: "select",
                  options: STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
                },
                { name: "notes", label: "Observações", type: "textarea" },
              ]}
            />
          )}
        </EntityForm>
      )}
    />
  );
}
