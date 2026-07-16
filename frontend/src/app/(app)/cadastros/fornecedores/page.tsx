"use client";

import { CrudPage } from "@/components/crud/CrudPage";
import { EntityForm, FormFields } from "@/components/crud/EntityForm";
import { Badge } from "@/components/ui/Badge";
import { nextCode } from "@/lib/codes";
import { useCompany } from "@/lib/company-context";
import type { Supplier } from "@/types/database";
import { STATUS_OPTIONS, SUPPLIER_CATEGORIES } from "@/types/database";

export default function FornecedoresPage() {
  const { companyId } = useCompany();

  return (
    <CrudPage<Supplier>
      title="Fornecedores"
      description="Postos, oficinas, seguradoras e demais fornecedores padronizados"
      table="suppliers"
      auditScreenKey="cadastros.fornecedores"
      orderBy="name"
      columns={[
        { key: "code", label: "Código" },
        { key: "name", label: "Fornecedor" },
        { key: "category", label: "Categoria" },
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
            category: item?.category ?? "Outros",
            document: item?.document ?? "",
            contact_name: item?.contact_name ?? "",
            phone: item?.phone ?? "",
            city: item?.city ?? "",
            status: item?.status ?? "Ativo",
            notes: item?.notes ?? "",
          }}
          onSubmit={async (data) => {
            if (!item?.id && companyId && !data.code) {
              data.code = await nextCode("suppliers", companyId, "FOR");
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
                { name: "name", label: "Fornecedor", required: true },
                {
                  name: "category",
                  label: "Categoria",
                  type: "select",
                  options: SUPPLIER_CATEGORIES.map((c) => ({ value: c, label: c })),
                },
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
