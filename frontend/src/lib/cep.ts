export type CepAddress = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  formatted: string;
};

export function normalizeCep(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function formatCep(value: string): string {
  const digits = normalizeCep(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatAddressFromCep(data: Omit<CepAddress, "cep" | "formatted">): string {
  const parts = [data.street, data.neighborhood, data.city, data.state].filter(Boolean);
  return parts.join(", ");
}

export async function fetchAddressByCep(cepInput: string): Promise<CepAddress> {
  const cep = normalizeCep(cepInput);
  if (cep.length !== 8) {
    throw new Error("Informe um CEP válido com 8 dígitos.");
  }

  const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`, { cache: "no-store" });
  if (!response.ok) {
    const viaCep = await fetchViaCep(cep);
    if (viaCep) return viaCep;
    throw new Error("CEP não encontrado. Verifique o número informado.");
  }

  const data = (await response.json()) as {
    cep?: string;
    state?: string;
    city?: string;
    neighborhood?: string;
    street?: string;
  };

  const street = data.street?.trim() ?? "";
  const neighborhood = data.neighborhood?.trim() ?? "";
  const city = data.city?.trim() ?? "";
  const state = data.state?.trim() ?? "";

  if (!city || !state) {
    throw new Error("CEP encontrado, mas sem cidade/UF. Preencha o endereço manualmente.");
  }

  const payload = { street, neighborhood, city, state };
  return {
    cep: formatCep(cep),
    ...payload,
    formatted: formatAddressFromCep(payload),
  };
}

async function fetchViaCep(cep: string): Promise<CepAddress | null> {
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { cache: "no-store" });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    erro?: boolean;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };

  if (data.erro) return null;

  const payload = {
    street: data.logradouro?.trim() ?? "",
    neighborhood: data.bairro?.trim() ?? "",
    city: data.localidade?.trim() ?? "",
    state: data.uf?.trim() ?? "",
  };

  if (!payload.city || !payload.state) return null;

  return {
    cep: formatCep(cep),
    ...payload,
    formatted: formatAddressFromCep(payload),
  };
}
