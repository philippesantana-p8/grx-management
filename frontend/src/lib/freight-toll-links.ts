export type TollLookupLink = {
  label: string;
  href: string;
  hint?: string;
};

export function buildTollLookupLinks(
  originAddress: string,
  destinationAddress: string
): TollLookupLink[] {
  const origin = originAddress.trim();
  const destination = destinationAddress.trim();
  if (!origin || !destination) return [];

  const originEnc = encodeURIComponent(origin);
  const destEnc = encodeURIComponent(destination);

  return [
    {
      label: "Google Maps — rota A → B",
      href: `https://www.google.com/maps/dir/${originEnc}/${destEnc}`,
      hint: "No app/web, ative “Evitar pedágios” para comparar; o total de pedágio aparece ao planejar a viagem.",
    },
    {
      label: "QualP — simulador de pedágios",
      href: "https://qualp.com.br/",
      hint: `Cole no simulador: A = ${origin} · B = ${destination}`,
    },
    {
      label: "ANTT — calculadora de frete (só carga)",
      href: "https://calculadorafrete.antt.gov.br/",
      hint: "Piso mínimo legal apenas para frete de carga (caminhão), não para van de passageiros.",
    },
  ];
}
