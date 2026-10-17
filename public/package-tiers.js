// Public names and legacy database values share one mapping. Existing records stay valid.
export const packageTiers = [
  { id: 'Start', name: 'STANDARD', monthlyPrice: 99000, familyMembers: 4, legalConsultations: 1, psychologicalConsultations: 1, businessConsultations: 0 },
  { id: 'Komfort', name: 'COMFORT', monthlyPrice: 199000, familyMembers: 5, legalConsultations: 2, psychologicalConsultations: 1, businessConsultations: 1 },
  { id: 'Premium', name: 'PREMIUM', monthlyPrice: 399000, familyMembers: 6, legalConsultations: 4, psychologicalConsultations: 2, businessConsultations: 2 }
];
export const packageName = tier => packageTiers.find(item => item.id === tier || item.name === tier)?.name || tier;
export const packageValue = tier => packageTiers.find(item => item.id === tier || item.name === tier)?.id || tier;
