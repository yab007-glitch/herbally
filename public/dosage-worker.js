import { clarksRule, youngsRule, bsaMethod, friedsRule, calculateBSA, lbsToKg, kgToLbs, recommendFormula } from './src/lib/utils/dosage-calculations';

// Expose these as a simple API for the service worker or UI
const dosageCalculator = {
  clarksRule,
  youngsRule,
  bsaMethod,
  friedsRule,
  calculateBSA,
  lbsToKg,
  kgToLbs,
  recommendFormula
};

self.addEventListener('message', (event) => {
  if (event.data.type === 'CALCULATE_DOSAGE') {
    const { formula, params } = event.data;
    let result;
    
    switch(formula) {
      case 'clarks_rule':
        result = dosageCalculator.clarksRule(params.weightKg, params.adultDoseMg);
        break;
      case 'youngs_rule':
        result = dosageCalculator.youngsRule(params.ageYears, params.adultDoseMg);
        break;
      case 'bsa':
        result = dosageCalculator.bsaMethod(params.heightCm, params.weightKg, params.adultDoseMg);
        break;
      case 'fried_rule':
        result = dosageCalculator.friedsRule(params.ageMonths, params.adultDoseMg);
        break;
      default:
        result = null;
    }
    
    event.ports[0].postMessage({ type: 'DOSAGE_RESULT', result });
  }
});
