const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("bankos_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("bankos_token");
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ accessToken: string; refreshToken: string; user: { id: string; firstName: string; lastName: string; email: string; roles: string[] } }>(
      "/auth/login",
      { email, password }
    ),
  logout: () => api.post("/auth/logout", {}),
};

// Leads (Aadhaar OTP-based lead creation)
export const leadsApi = {
  sendOtp: (aadhaarNumber: string) =>
    api.post<{ txnId: string; maskedAadhaar: string }>("/leads/aadhaar/send-otp", {
      aadhaarNumber,
    }),
  verifyOtp: (payload: {
    txnId: string;
    otp: string;
    aadhaarNumber: string;
    productId: string;
    branchId: string;
    requestedAmountPaisa: number;
    requestedTenureMonths: number;
  }) => api.post<LeadCreationResult>("/leads/aadhaar/verify-otp", payload),
  getStatus: (applicationId: string) =>
    api.get<LeadCreationResult>(`/leads/${applicationId}`),
};

// Applications
export const applicationsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<{ data: Application[]; total: number; page: number; limit: number }>(
      `/applications${qs}`
    );
  },
  get: (id: string) => api.get<Application>(`/applications/${id}`),
  transition: (id: string, status: string, comment?: string) =>
    api.patch(`/applications/${id}/status`, { status, comment }),
  assign: (id: string, officerId: string) =>
    api.patch(`/applications/${id}/assign`, { officerId }),
};

// Customers
export const customersApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<{ data: Customer[]; total: number }>(`/customers${qs}`);
  },
  get: (id: string) => api.get<Customer>(`/customers/${id}`),
};

// Loans
export const loansApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<{ data: Loan[]; total: number }>(`/loans${qs}`);
  },
  get: (id: string) => api.get<Loan>(`/loans/${id}`),
  getEmiSchedule: (id: string) => api.get<EmiInstallment[]>(`/loans/${id}/schedule`),
};

// BRE Rules
export const breApi = {
  listRules: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<{ data: BRERule[]; total: number }>(`/bre/rules${qs}`);
  },
  createRule: (rule: Partial<BRERule>) => api.post<BRERule>("/bre/rules", rule),
  updateRule: (id: string, rule: Partial<BRERule>) => api.put<BRERule>(`/bre/rules/${id}`, rule),
  toggleRule: (id: string, active: boolean) =>
    api.patch(`/bre/rules/${id}/toggle`, { active }),
};

// Collections
export const collectionsApi = {
  dashboard: () => api.get<CollectionDashboard>("/collections/dashboard"),
  tasks: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<{ data: CollectionTask[] }>(`/collections/tasks${qs}`);
  },
};

// Reports
export const reportsApi = {
  portfolio: () => api.get<PortfolioSummary>("/reports/portfolio"),
};

// Types
export interface Application {
  id: string;
  applicationNumber: string;
  status: ApplicationStatus;
  product: string;
  loanAmount: number;
  applicantName: string;
  applicantPan: string;
  dsaName?: string;
  assignedOfficer?: string;
  createdAt: string;
  updatedAt: string;
  daysInStage?: number;
  bureauScore?: number;
  breDecision?: "APPROVED" | "REJECTED" | "REFERRED";
  documents?: Document[];
  statusHistory?: StatusHistory[];
  breRuleResults?: BRERuleResult[];
}

export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "BUREAU_CHECK"
  | "BRE_CHECK"
  | "CREDIT_REVIEW"
  | "SANCTIONED"
  | "DOCUMENTATION"
  | "DISBURSED"
  | "REJECTED"
  | "WITHDRAWN";

export interface Customer {
  id: string;
  name: string;
  pan: string;
  mobile: string;
  email?: string;
  kycStatus: "PENDING" | "VERIFIED" | "REJECTED";
  createdAt: string;
  totalLoans?: number;
  activeLoans?: number;
}

export interface Loan {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  product: string;
  principalAmount: number;
  outstandingAmount: number;
  status: "ACTIVE" | "CLOSED" | "NPA" | "WRITTEN_OFF";
  dpd: number;
  emiAmount: number;
  nextDueDate: string;
  disbursedAt: string;
  branch?: string;
}

export interface EmiInstallment {
  installmentNumber: number;
  dueDate: string;
  emiAmount: number;
  principalAmount: number;
  interestAmount: number;
  status: "PENDING" | "PAID" | "OVERDUE";
  paidDate?: string;
  paidAmount?: number;
}

export interface BRERule {
  id: string;
  name: string;
  description?: string;
  product: string;
  category: string;
  condition: string;
  action: "APPROVE" | "REJECT" | "REFER";
  priority: number;
  active: boolean;
  createdAt: string;
}

export interface BRERuleResult {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  value?: string;
  threshold?: string;
}

export interface CollectionTask {
  id: string;
  loanId: string;
  loanNumber: string;
  customerName: string;
  mobile: string;
  dpd: number;
  overdueAmount: number;
  assignedAgent?: string;
  status: "PENDING" | "CONTACTED" | "PTP" | "RESOLVED";
  scheduledDate: string;
}

export interface CollectionDashboard {
  dpdBuckets: { bucket: string; count: number; amount: number }[];
  todayTasks: number;
  efficiency: number;
  totalOverdue: number;
}

export interface PortfolioSummary {
  totalAUM: number;
  totalCustomers: number;
  activeLoans: number;
  npaPercentage: number;
  collectionEfficiency: number;
  disbursedThisMonth: number;
  monthlyTrend: { month: string; disbursed: number; collected: number }[];
  productBreakdown: { product: string; amount: number }[];
}

export interface Document {
  id: string;
  type: string;
  name: string;
  status: "PENDING" | "UPLOADED" | "VERIFIED" | "REJECTED";
  uploadedAt?: string;
  url?: string;
}

export interface StatusHistory {
  status: string;
  timestamp: string;
  actor: string;
  comment?: string;
}

export interface LeadCreationResult {
  customer: {
    id: string;
    customerNumber: string;
    fullName: string;
    dateOfBirth: string;
    gender: string;
    kycStatus: string;
    currentAddressLine1?: string;
    currentAddressLine2?: string;
    currentCity?: string;
    currentState?: string;
    currentPincode?: string;
  };
  application: {
    id: string;
    applicationNumber: string;
    status: string;
    requestedAmountPaisa: number;
    requestedTenureMonths: number;
    product?: { name: string; code: string; productType: string };
    branch?: { name: string; code: string };
  };
  isExisting: boolean;
}
