const BASE_URL = 'http://localhost:3000/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Loan {
  loanId: string;
  loanNumber: string;
  product: string;
  principalAmount: number;
  outstandingAmount: number;
  nextEmiDate: string;
  nextEmiAmount: number;
  dpd: number;
  status: 'ACTIVE' | 'CLOSED' | 'NPA';
  tenure: number;
  disbursedAt: string;
}

export interface EmiScheduleEntry {
  installmentNumber: number;
  dueDate: string;
  principal: number;
  interest: number;
  totalAmount: number;
  paidAmount: number;
  status: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE';
  paidDate?: string;
}

export interface OtpResponse {
  message: string;
  requestId: string;
}

export interface LoginResponse {
  token: string;
  userId: string;
  name: string;
  phone: string;
}

// ---------------------------------------------------------------------------
// Mock data (used when API is unavailable)
// ---------------------------------------------------------------------------

const MOCK_LOANS: Loan[] = [
  {
    loanId: 'loan-001',
    loanNumber: 'LN-2024-001',
    product: 'Personal Loan',
    principalAmount: 200000,
    outstandingAmount: 145000,
    nextEmiDate: '2026-04-05',
    nextEmiAmount: 9500,
    dpd: 0,
    status: 'ACTIVE',
    tenure: 24,
    disbursedAt: '2024-04-01',
  },
  {
    loanId: 'loan-002',
    loanNumber: 'LN-2024-002',
    product: 'Business Loan',
    principalAmount: 500000,
    outstandingAmount: 380000,
    nextEmiDate: '2026-04-10',
    nextEmiAmount: 18200,
    dpd: 5,
    status: 'ACTIVE',
    tenure: 36,
    disbursedAt: '2024-03-15',
  },
];

const MOCK_SCHEDULE: EmiScheduleEntry[] = [
  { installmentNumber: 1, dueDate: '2024-05-05', principal: 7200, interest: 2300, totalAmount: 9500, paidAmount: 9500, status: 'PAID', paidDate: '2024-05-04' },
  { installmentNumber: 2, dueDate: '2024-06-05', principal: 7350, interest: 2150, totalAmount: 9500, paidAmount: 9500, status: 'PAID', paidDate: '2024-06-03' },
  { installmentNumber: 3, dueDate: '2024-07-05', principal: 7500, interest: 2000, totalAmount: 9500, paidAmount: 9500, status: 'PAID', paidDate: '2024-07-06' },
  { installmentNumber: 4, dueDate: '2024-08-05', principal: 7650, interest: 1850, totalAmount: 9500, paidAmount: 4000, status: 'PARTIAL', paidDate: '2024-08-05' },
  { installmentNumber: 5, dueDate: '2024-09-05', principal: 7800, interest: 1700, totalAmount: 9500, paidAmount: 0, status: 'OVERDUE' },
  { installmentNumber: 6, dueDate: '2026-04-05', principal: 7950, interest: 1550, totalAmount: 9500, paidAmount: 0, status: 'PENDING' },
  { installmentNumber: 7, dueDate: '2026-05-05', principal: 8100, interest: 1400, totalAmount: 9500, paidAmount: 0, status: 'PENDING' },
  { installmentNumber: 8, dueDate: '2026-06-05', principal: 8250, interest: 1250, totalAmount: 9500, paidAmount: 0, status: 'PENDING' },
];

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function sendOtp(phone: string): Promise<OtpResponse> {
  try {
    return await request<OtpResponse>('/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  } catch {
    // Mock fallback
    return { message: 'OTP sent successfully', requestId: 'mock-req-001' };
  }
}

export async function verifyOtp(phone: string, otp: string): Promise<LoginResponse> {
  try {
    return await request<LoginResponse>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    });
  } catch {
    if (otp === '123456') {
      return { token: 'mock-token-xyz', userId: 'user-001', name: 'Rahul Sharma', phone };
    }
    throw new Error('Invalid OTP. Use 123456 for demo.');
  }
}

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

let authToken = '';
export function setAuthToken(token: string) {
  authToken = token;
}

export async function getMyLoans(): Promise<Loan[]> {
  try {
    return await request<Loan[]>('/loans/my', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
  } catch {
    return MOCK_LOANS;
  }
}

export async function getLoanById(loanId: string): Promise<Loan> {
  try {
    return await request<Loan>(`/loans/${loanId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
  } catch {
    const loan = MOCK_LOANS.find(l => l.loanId === loanId);
    if (!loan) throw new Error('Loan not found');
    return loan;
  }
}

export async function getEmiSchedule(loanId: string): Promise<EmiScheduleEntry[]> {
  try {
    return await request<EmiScheduleEntry[]>(`/loans/${loanId}/schedule`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
  } catch {
    return MOCK_SCHEDULE;
  }
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export function generateUpiLink(params: {
  vpa: string;
  name: string;
  amount: number;
  loanNumber: string;
}): string {
  const { vpa, name, amount, loanNumber } = params;
  const note = encodeURIComponent(`EMI for ${loanNumber}`);
  return `upi://pay?pa=${vpa}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${note}`;
}
