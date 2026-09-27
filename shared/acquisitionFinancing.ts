/** Existing screening assumptions, not current lender terms or SBA eligibility. */
export const ACQUISITION_FINANCING_ASSUMPTIONS = Object.freeze({
  loanFraction: 0.9,
  annualRate: 0.115,
  months: 120,
});

/** Seller cash flow is only a screening proxy, not verified cash available for debt service. */
export function modelAcquisitionFinancing(askingPrice: number | null, sellerCashFlow: number | null) {
  if (askingPrice == null || !Number.isFinite(askingPrice) || askingPrice <= 0) return null;
  const { loanFraction, annualRate, months } = ACQUISITION_FINANCING_ASSUMPTIONS;
  const loanAmount = askingPrice * loanFraction;
  const equityAmount = askingPrice - loanAmount;
  const monthlyRate = annualRate / 12;
  const annualDebtService = 12 * loanAmount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
  const cashCoverage = sellerCashFlow != null && Number.isFinite(sellerCashFlow) ? sellerCashFlow / annualDebtService : null;
  return { loanAmount, equityAmount, annualDebtService, cashCoverage };
}
