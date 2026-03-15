export type Role =
  | "owner"
  | "admin"
  | "manager"
  | "member"
  | "client"
  | "auditor"
  | "viewer"
  | "vendor";

export type SidebarItem = {
  label: string;
  href: string;
};

type RoleConfig = {
  permissions: {
    manageMembers: boolean;
    inviteUsers: boolean;
    approveRequests: boolean;
    manageOrganization: boolean;
    viewReports: boolean;
    readOnly: boolean;
    viewDashboard?: boolean;
    viewContracts?: boolean;
    submitCompletion?: boolean;
    uploadDocuments?: boolean;
    viewPayments?: boolean;
  };
  sidebar: SidebarItem[];
};


export const ROLE_CONFIG: Record<Role, RoleConfig> = {
  owner: {
    permissions: {
      manageMembers: true,
      inviteUsers: true,
      approveRequests: true,
      manageOrganization: true,
      viewReports: true,
      readOnly: false,
      viewDashboard: true,
      viewContracts: true,
      submitCompletion: true,
      uploadDocuments: true,
      viewPayments: true,
    },
    sidebar: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Awards", href: "/awards" },
      { label: "Requests", href: "/requests" },
      { label: "Members", href: "/dashboard/members" },
      { label: "Invitations", href: "/invitations" },
      { label: "Profiles", href: "/settings/users" },
      { label: "Organizations", href: "/settings/organizations" },
      { label: "Membership Requests", href: "/dashboard/membership-requests" },
      { label: "Contracts", href: "/contracts" },
      { label: "Reports", href: "/reports" },
      { label: "Onboarding", href: "/dashboard/onboarding" },
      { label: "Analytics", href: "/dashboard/analytics" },
      { label: "Audit Logs", href: "/audit" },
      { label: "Vendor Dashboard", href: "/vendor/dashboard" },
      { label: "Vendor Contracts", href: "/vendor/contracts" },
      { label: "Payment Approvals", href: "/contracts/payment-approval" },
      { label: "Payments", href: "/payments" },
      { label: "Vendor Payments", href: "/vendor/payments" },
    ],
  },

  admin: {
    permissions: {
      manageMembers: true,
      inviteUsers: true,
      approveRequests: true,
      manageOrganization: true,
      viewReports: true,
      readOnly: false,
      viewDashboard: true,
      viewContracts: true,
      submitCompletion: true,
      uploadDocuments: true,
      viewPayments: true,
    },
    sidebar: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Members", href: "/dashboard/members" },
      { label: "Invitations", href: "/invitations" },
      { label: "Membership Requests", href: "/membership-requests" },
      { label: "Contracts", href: "/contracts" },
      { label: "Completion Reviews", href: "/contracts/completion-review" },
      { label: "Reports", href: "/reports" },
      { label: "Profiles", href: "/settings/users" },
      { label: "Organizations", href: "/settings/organizations" },
    ],
  },

  manager: {
    permissions: {
      manageMembers: true,
      inviteUsers: true,
      approveRequests: true,
      manageOrganization: false,
      viewReports: true,
      readOnly: false,
      viewDashboard: true,
      viewContracts: true,
      submitCompletion: true,
      uploadDocuments: true,
      viewPayments: true,
    },
    sidebar: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Members", href: "/dashboard/members" },
      { label: "Invitations", href: "/invitations" },
      { label: "Requests", href: "/requests" },
      { label: "Membership Requests", href: "/membership-requests" },
      { label: "Contracts", href: "/contracts" },
      { label: "Completion Reviews", href: "/contracts/completion-review" },
      { label: "Reports", href: "/reports" },
      { label: "Profiles", href: "/settings/users" },
      { label: "Organizations", href: "/settings/organizations" },
    ],
  },

  member: {
    permissions: {
      manageMembers: false,
      inviteUsers: false,
      approveRequests: false,
      manageOrganization: false,
      viewReports: true,
      readOnly: false,
      viewDashboard: true,
      viewContracts: false ,
      submitCompletion: false,
      uploadDocuments: false,
      viewPayments: false,
    },
    sidebar: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Contracts", href: "/contracts" },
      { label: "Reports", href: "/reports" },
      { label: "Profiles", href: "/settings/users" },
      { label: "Organizations", href: "/settings/organizations" },
    ],
  },

  client: {
    permissions: {
      manageMembers: false,
      inviteUsers: false,
      approveRequests: false,
      manageOrganization: false,
      viewReports: false,
      readOnly: false,
      viewDashboard: false,
      viewContracts: false,
      submitCompletion: false,
      uploadDocuments: false,
      viewPayments: false,
    },
    sidebar: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "My Contracts", href: "/contracts" },
      { label: "My Requests", href: "/requests" },
      { label: "Profiles", href: "/settings/users" },
      { label: "Organizations", href: "/settings/organizations" },
    ],
  },

  auditor: {
    permissions: {
      manageMembers: false,
      inviteUsers: false,
      approveRequests: false,
      manageOrganization: false,
      viewReports: true,
      readOnly: true,
      viewDashboard: false,
      viewContracts: false,
      submitCompletion: false,
      uploadDocuments: false,
      viewPayments: false,
    },
    sidebar: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Members", href: "/dashboard/members" },
      { label: "Contracts", href: "/contracts" },
      { label: "Reports", href: "/reports" },
      { label: "Audit Logs", href: "/audit" },
      { label: "Profiles", href: "/settings/users" },
      { label: "Organizations", href: "/settings/organizations" },
    ],
  },

  viewer: {
    permissions: {
      manageMembers: false,
      inviteUsers: false,
      approveRequests: false,
      manageOrganization: false,
      viewReports: true,
      readOnly: true,
      viewDashboard: true,
      viewContracts: false,
      submitCompletion: false,
      uploadDocuments: false,
      viewPayments: false,
    },
    sidebar: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Reports", href: "/reports" },
      { label: "Profiles", href: "/settings/users" },
      { label: "Organizations", href: "/settings/organizations" },
    ],
  },

  vendor: {
    permissions: {
      manageMembers: false,
      inviteUsers: false,
      approveRequests: false,
      manageOrganization: false,
      viewReports: false,
      readOnly: false,
      viewDashboard: true,
      viewContracts: true,
      submitCompletion: true,
      uploadDocuments: true,
      viewPayments: true,
    },
    sidebar: [
      { label: "My Dashboard", href: "/vendor/dashboard" },
      { label: "My Contracts", href: "/vendor/contracts" },
      { label: "My Payments", href: "/vendor/payments" },
      { label: "Deliverables", href: "/vendor/deliverables" },
      { label: "Profiles", href: "/settings/users" },
      { label: "Organizations", href: "/settings/organizations" },
      { label: "Requests", href: "/requests" },
    ],
  }
};

export function getPermissions(role: Role | null) {
  if (!role) return null;
  return ROLE_CONFIG[role].permissions;
}

export function getSidebarLinks(role: Role | null): SidebarItem[] {
  if (!role) return [];
  return ROLE_CONFIG[role].sidebar;
}