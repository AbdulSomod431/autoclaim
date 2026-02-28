export interface PartPricing {
  id: number;
  make: string;
  model: string;
  year_start: number;
  year_end: number;
  part_name: string;
  price_tokunbo: number;
  price_new: number;
  labor_cost: number;
}

export interface PolicyInfo {
  id: number;
  plate_number: string;
  owner_name: string;
  insurance_company: string;
  expiry_date: string;
  status: 'Active' | 'Expired';
}

export interface DamageAnalysis {
  vehicle_info: {
    make: string;
    model: string;
    year: string;
    plate: string;
  };
  damage_summary: string[];
  severity: 'Minor' | 'Moderate' | 'Structural' | 'Totaled';
  confidence_score: number;
  is_consistent: boolean;
}

export interface ClaimReport {
  analysis: DamageAnalysis;
  policy?: PolicyInfo;
  estimated_payout: number;
  breakdown: {
    part_name: string;
    cost: number;
    labor: number;
    type: 'Tokunbo' | 'New';
  }[];
}
