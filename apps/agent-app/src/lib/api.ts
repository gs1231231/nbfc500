const BASE_URL = 'http://localhost:3000/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export interface CollectionTask {
  taskId: string;
  loanId: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  lat?: number;
  lng?: number;
  dpd: number;
  amountDue: number;
  priority: Priority;
  status: TaskStatus;
  lastContactDate?: string;
  lastDisposition?: string;
  visitCount: number;
}

export type DispositionType =
  | 'PTP'
  | 'NOT_AVAILABLE'
  | 'REFUSED'
  | 'PARTIAL_PAYMENT'
  | 'FULL_PAYMENT'
  | 'MOVED'
  | 'DECEASED'
  | 'DISPUTED';

export interface DispositionPayload {
  taskId: string;
  loanId: string;
  type: DispositionType;
  ptpDate?: string;
  ptpAmount?: number;
  remarks: string;
  gpsLat?: number;
  gpsLng?: number;
  visitedAt: string;
}

export interface DispositionResponse {
  dispositionId: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

export const MOCK_TASKS: CollectionTask[] = [
  {
    taskId: 'task-001',
    loanId: 'loan-201',
    loanNumber: 'LN-2023-201',
    customerId: 'cust-001',
    customerName: 'Amit Verma',
    customerPhone: '9876543210',
    address: '14, Laxmi Nagar, Near SBI ATM, Delhi - 110092',
    lat: 28.6272,
    lng: 77.2778,
    dpd: 90,
    amountDue: 45000,
    priority: 'CRITICAL',
    status: 'PENDING',
    lastContactDate: '2026-02-20',
    lastDisposition: 'NOT_AVAILABLE',
    visitCount: 3,
  },
  {
    taskId: 'task-002',
    loanId: 'loan-202',
    loanNumber: 'LN-2023-202',
    customerId: 'cust-002',
    customerName: 'Sunita Devi',
    customerPhone: '9123456789',
    address: '7B, Rohini Sector 5, Delhi - 110085',
    lat: 28.7167,
    lng: 77.0742,
    dpd: 60,
    amountDue: 22000,
    priority: 'HIGH',
    status: 'PENDING',
    lastContactDate: '2026-03-01',
    lastDisposition: 'PTP',
    visitCount: 1,
  },
  {
    taskId: 'task-003',
    loanId: 'loan-203',
    loanNumber: 'LN-2024-203',
    customerId: 'cust-003',
    customerName: 'Rajesh Kumar Singh',
    customerPhone: '9988776655',
    address: 'Plot 22, Dwarka Sector 10, Delhi - 110075',
    lat: 28.5823,
    lng: 77.0337,
    dpd: 30,
    amountDue: 9800,
    priority: 'MEDIUM',
    status: 'PENDING',
    lastContactDate: '2026-03-10',
    lastDisposition: 'NOT_AVAILABLE',
    visitCount: 2,
  },
  {
    taskId: 'task-004',
    loanId: 'loan-204',
    loanNumber: 'LN-2024-204',
    customerId: 'cust-004',
    customerName: 'Priya Sharma',
    customerPhone: '9871234560',
    address: 'A-12, Mayur Vihar Phase 1, Delhi - 110091',
    lat: 28.6090,
    lng: 77.2927,
    dpd: 15,
    amountDue: 5500,
    priority: 'LOW',
    status: 'COMPLETED',
    lastContactDate: '2026-03-20',
    lastDisposition: 'FULL_PAYMENT',
    visitCount: 1,
  },
  {
    taskId: 'task-005',
    loanId: 'loan-205',
    loanNumber: 'LN-2023-205',
    customerId: 'cust-005',
    customerName: 'Mohammed Irfan',
    customerPhone: '9654321098',
    address: '3rd Floor, Jamia Nagar, Okhla, Delhi - 110025',
    lat: 28.5540,
    lng: 77.2817,
    dpd: 120,
    amountDue: 78000,
    priority: 'CRITICAL',
    status: 'PENDING',
    lastContactDate: '2026-02-10',
    lastDisposition: 'REFUSED',
    visitCount: 5,
  },
];

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AgentLoginResponse {
  token: string;
  agentId: string;
  name: string;
  employeeCode: string;
}

let authToken = '';
export function setAuthToken(token: string) {
  authToken = token;
}

export async function agentLogin(employeeCode: string, password: string): Promise<AgentLoginResponse> {
  try {
    const res = await fetch(`${BASE_URL}/agent/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeCode, password }),
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  } catch {
    // Mock: accept any employee code with password "agent123"
    if (password === 'agent123') {
      return {
        token: 'mock-agent-token',
        agentId: 'agent-001',
        name: 'Suresh Patel',
        employeeCode,
      };
    }
    throw new Error('Invalid credentials. Use password: agent123 for demo.');
  }
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function getTodayTasks(agentId: string): Promise<CollectionTask[]> {
  try {
    const res = await fetch(`${BASE_URL}/agent/tasks/today`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  } catch {
    return MOCK_TASKS.sort((a, b) => {
      const priorityOrder: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
}

export async function getTaskById(taskId: string): Promise<CollectionTask> {
  try {
    const res = await fetch(`${BASE_URL}/agent/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) throw new Error('Task not found');
    return res.json();
  } catch {
    const task = MOCK_TASKS.find(t => t.taskId === taskId);
    if (!task) throw new Error('Task not found');
    return task;
  }
}

// ---------------------------------------------------------------------------
// Dispositions
// ---------------------------------------------------------------------------

export async function submitDisposition(payload: DispositionPayload): Promise<DispositionResponse> {
  try {
    const res = await fetch(`${BASE_URL}/agent/dispositions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Submission failed');
    return res.json();
  } catch {
    // Mock success
    return { dispositionId: `disp-${Date.now()}`, message: 'Disposition recorded successfully.' };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getMapsUrl(address: string, lat?: number, lng?: number): string {
  if (lat && lng) {
    return `https://maps.google.com/?q=${lat},${lng}`;
  }
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

export const DISPOSITION_OPTIONS: { value: DispositionType; label: string }[] = [
  { value: 'PTP', label: 'Promise to Pay (PTP)' },
  { value: 'FULL_PAYMENT', label: 'Full Payment Collected' },
  { value: 'PARTIAL_PAYMENT', label: 'Partial Payment Collected' },
  { value: 'NOT_AVAILABLE', label: 'Customer Not Available' },
  { value: 'REFUSED', label: 'Refused to Pay' },
  { value: 'MOVED', label: 'Customer Has Moved' },
  { value: 'DECEASED', label: 'Customer Deceased' },
  { value: 'DISPUTED', label: 'Loan Disputed' },
];
