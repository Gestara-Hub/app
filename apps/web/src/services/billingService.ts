// Shim: o dominio de cobrancas vive em ./billing (doc 12, fase 4).
export {
  autoGenerateMembershipCharges,
  billingService,
  cancelOpenMembershipCharges,
  chargeStartedMembershipPeriods,
  ensureMembershipCharges,
  isPlanlessScholar,
  membershipPeriodTaken,
  planlessScholarCharges,
  scholarshipChargeFields,
  studentMembershipTerms,
  syncChargesFromDb,
  syncPlansFromDb,
} from "./billing";
