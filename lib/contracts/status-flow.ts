export const CONTRACT_STATUS_FLOW = [
  "draft",
  "active",
  "at_risk",
  "completed",
  "closed",
  "terminated",
] as const;

export type ContractStatus = typeof CONTRACT_STATUS_FLOW[number];