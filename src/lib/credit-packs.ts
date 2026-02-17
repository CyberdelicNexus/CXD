export interface CreditPack {
  id: string;
  name: string;
  price: number; // USD cents
  credits: number;
  bonusLabel?: string;
  popular?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "starter", name: "Starter", price: 500, credits: 100 },
  {
    id: "popular",
    name: "Popular",
    price: 1000,
    credits: 250,
    bonusLabel: "+25%",
    popular: true,
  },
  {
    id: "power",
    name: "Power",
    price: 2000,
    credits: 600,
    bonusLabel: "+50%",
  },
  {
    id: "mega",
    name: "Mega",
    price: 5000,
    credits: 1750,
    bonusLabel: "+75%",
  },
];

export function getCreditPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}
