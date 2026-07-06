export type PartnerSeedRow = {
  code: string;
  name: string;
  partner_type: string;
};

export type VehicleSeedRow = {
  code: string;
  plate: string;
  vehicle_category: string;
  status: string;
};

export type OwnershipSeedRow = {
  plate: string;
  partner: string;
  ownership_percentage: number;
  operational: boolean;
  status: string;
  effective_date: string;
};

/** Sócios da aba Cadastro_Socios (planilha GRX V3) */
export const PARTNER_SEED: PartnerSeedRow[] = [
  {
    "code": "SOC001",
    "name": "Rafael",
    "partner_type": "Socio"
  },
  {
    "code": "SOC002",
    "name": "Malu",
    "partner_type": "Parceira"
  },
  {
    "code": "SOC003",
    "name": "Luca",
    "partner_type": "Socio"
  },
  {
    "code": "SOC004",
    "name": "Sérgio",
    "partner_type": "Socio"
  },
  {
    "code": "SOC005",
    "name": "GRX",
    "partner_type": "Empresa"
  }
];

/** Veículos da aba Cadastro_Veiculos (planilha GRX V3) */
export const VEHICLE_SEED: VehicleSeedRow[] = [
  {
    "code": "VEI001",
    "plate": "SWU9H17",
    "vehicle_category": "Van",
    "status": "Ativo"
  },
  {
    "code": "VEI002",
    "plate": "GHR2C77",
    "vehicle_category": "Van",
    "status": "Ativo"
  },
  {
    "code": "VEI003",
    "plate": "TLS6D65",
    "vehicle_category": "Van",
    "status": "Ativo"
  },
  {
    "code": "VEI004",
    "plate": "SUY3I05",
    "vehicle_category": "Van",
    "status": "Ativo"
  }
];

/** Participações da aba Participacao_Veiculo (planilha GRX V3) */
export const OWNERSHIP_SEED: OwnershipSeedRow[] = [
  {
    "plate": "SWU9H17",
    "partner": "Rafael",
    "ownership_percentage": 100.0,
    "operational": true,
    "status": "Ativo",
    "effective_date": "2026-01-01"
  },
  {
    "plate": "TLS6D65",
    "partner": "Rafael",
    "ownership_percentage": 50.0,
    "operational": true,
    "status": "Ativo",
    "effective_date": "2026-01-01"
  },
  {
    "plate": "TLS6D65",
    "partner": "Malu",
    "ownership_percentage": 50.0,
    "operational": false,
    "status": "Ativo",
    "effective_date": "2026-01-01"
  },
  {
    "plate": "GHR2C77",
    "partner": "GRX",
    "ownership_percentage": 100.0,
    "operational": true,
    "status": "Ativo",
    "effective_date": "2026-01-01"
  }
];
