// lib/contracts/activity-types.ts
export const CONTRACT_ACTIVITY_TYPES = {
  CONTRACT_CREATED: "contract_created",
  CONTRACT_UPDATED: "contract_updated",
  VENDOR_ASSIGNED: "vendor_assigned",
  DELIVERABLES_UPLOADED: "deliverables_uploaded",
  COMPLETION_SUBMITTED: "completion_submitted",
  COMPLETION_REVIEWED: "completion_reviewed",
  COMPLETION_APPROVED: "completion_approved",
  RECEIPT_SUBMITTED: "receipt_submitted",
  RECEIPT_APPROVED: "receipt_approved",
  PAYMENT_APPROVED: "payment_approved",
  PAYMENT_ISSUED: "payment_issued",
  STATUS_CHANGED: "status_changed",
  CONTRACT_CLOSED: "contract_closed",
  ADMIN_NOTE: "admin_note",
} as const;

export type ContractActivityType =
  (typeof CONTRACT_ACTIVITY_TYPES)[keyof typeof CONTRACT_ACTIVITY_TYPES];