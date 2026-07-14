const res = await fetch("https://grx-management.vercel.app/operacional/ordens-servico");
const html = await res.text();
const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0]);
console.log("status", res.status, "chunks", chunks.length);
let foundGate = false;
let foundPanelAlways = false;
for (const path of chunks.slice(0, 40)) {
  const url = `https://grx-management.vercel.app${path}`;
  const js = await (await fetch(url)).text();
  if (js.includes("serviceOrderShowsPassengers") || js.includes("liquid-glass-field--required")) {
    foundGate = true;
    console.log("gate in", path);
  }
  if (js.includes("Passageiros no veículo") && js.includes("serviceOrderShowsPassengers")) {
    foundPanelAlways = true;
  }
}
console.log("foundGate", foundGate, "panelWithGate", foundPanelAlways);
