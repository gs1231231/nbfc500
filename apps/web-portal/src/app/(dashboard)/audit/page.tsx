"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown>;
  createdAt: string;
}

interface PaginatedAuditLogs {
  data: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

const ACTION_COLORS: Record<
  string,
  "default" | "success" | "warning" | "destructive" | "secondary"
> = {
  CREATE: "success",
  UPDATE: "warning",
  DELETE: "destructive",
  VIEW: "secondary",
  APPROVE: "success",
  REJECT: "destructive",
};

const MOCK_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "1",
    userId: "USR-001",
    action: "UPDATE",
    entityType: "LOAN",
    entityId: "LOAN-001",
    changes: { status: { from: "DISBURSED", to: "ACTIVE" } },
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "2",
    userId: "USR-002",
    action: "APPROVE",
    entityType: "APPLICATION",
    entityId: "APP-042",
    changes: { sanctionedAmount: 500000 },
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: "3",
    userId: "USR-001",
    action: "CREATE",
    entityType: "CUSTOMER",
    entityId: "CUST-210",
    changes: { firstName: "Ramesh", lastName: "Gupta" },
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: "4",
    userId: "USR-003",
    action: "DELETE",
    entityType: "DOCUMENT",
    entityId: "DOC-099",
    changes: { reason: "Duplicate upload" },
    createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
];

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>(MOCK_AUDIT_LOGS);
  const [total, setTotal] = useState(MOCK_AUDIT_LOGS.length);
  const [filters, setFilters] = useState({
    entityType: "",
    action: "",
    userId: "",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const applyFilters = useCallback(() => {
    let results = [...MOCK_AUDIT_LOGS];
    if (filters.entityType)
      results = results.filter((l) =>
        l.entityType.toLowerCase().includes(filters.entityType.toLowerCase()),
      );
    if (filters.action)
      results = results.filter((l) =>
        l.action.toLowerCase().includes(filters.action.toLowerCase()),
      );
    if (filters.userId)
      results = results.filter((l) =>
        l.userId.toLowerCase().includes(filters.userId.toLowerCase()),
      );
    if (filters.from)
      results = results.filter((l) => l.createdAt >= filters.from);
    if (filters.to) results = results.filter((l) => l.createdAt <= filters.to);
    setTotal(results.length);
    const start = (page - 1) * PAGE_SIZE;
    setLogs(results.slice(start, start + PAGE_SIZE));
  }, [filters, page]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
        <p className="text-sm text-gray-500 mt-1">
          Complete change history for all entities in the system.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Entity Type
              </label>
              <input
                type="text"
                placeholder="e.g. LOAN"
                value={filters.entityType}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, entityType: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Action
              </label>
              <input
                type="text"
                placeholder="e.g. UPDATE"
                value={filters.action}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, action: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                User ID
              </label>
              <input
                type="text"
                placeholder="User ID"
                value={filters.userId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, userId: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, from: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, to: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={applyFilters}
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Search className="h-3.5 w-3.5" />
              Apply
            </button>
            <button
              onClick={() => {
                setFilters({ entityType: "", action: "", userId: "", from: "", to: "" });
                setPage(1);
              }}
              className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>
            Audit Logs{" "}
            <span className="text-sm font-normal text-gray-500">
              ({total} entries)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-gray-400 py-8"
                  >
                    No audit logs found.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-700">
                      {log.userId}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={ACTION_COLORS[log.action] ?? "default"}
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium text-gray-900">
                      {log.entityType}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-blue-600">
                      {log.entityId}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 max-w-xs truncate">
                      {JSON.stringify(log.changes)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
