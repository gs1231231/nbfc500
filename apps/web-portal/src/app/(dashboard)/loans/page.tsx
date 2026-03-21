"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockLoans } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Loan } from "@/lib/api";

const STATUS_COLORS = {
  ACTIVE: "success",
  CLOSED: "secondary",
  NPA: "destructive",
  WRITTEN_OFF: "outline",
} as const;

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterProduct, setFilterProduct] = useState("ALL");

  useEffect(() => {
    setLoans(mockLoans);
  }, []);

  const filtered = loans.filter((l) => {
    const matchSearch =
      l.loanNumber.toLowerCase().includes(search.toLowerCase()) ||
      l.customerName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "ALL" || l.status === filterStatus;
    const matchProduct = filterProduct === "ALL" || l.product === filterProduct;
    return matchSearch && matchStatus && matchProduct;
  });

  const products = ["ALL", ...Array.from(new Set(loans.map((l) => l.product)))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Loans</h1>
        <p className="text-sm text-gray-500 mt-1">{filtered.length} loans</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by loan # or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-36"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="CLOSED">Closed</option>
                <option value="NPA">NPA</option>
                <option value="WRITTEN_OFF">Written Off</option>
              </Select>
              <Select
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                className="w-40"
              >
                {products.map((p) => (
                  <option key={p} value={p}>
                    {p === "ALL" ? "All Products" : p}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>EMI</TableHead>
                <TableHead>DPD</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-gray-400 py-12">
                    No loans found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <span className="font-mono text-xs text-gray-700">{loan.loanNumber}</span>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-gray-900">{loan.customerName}</p>
                      {loan.branch && <p className="text-xs text-gray-500">{loan.branch}</p>}
                    </TableCell>
                    <TableCell className="text-gray-600">{loan.product}</TableCell>
                    <TableCell>{formatCurrency(loan.principalAmount)}</TableCell>
                    <TableCell>{formatCurrency(loan.outstandingAmount)}</TableCell>
                    <TableCell>{formatCurrency(loan.emiAmount)}</TableCell>
                    <TableCell>
                      <span
                        className={`font-semibold ${
                          loan.dpd > 90
                            ? "text-red-600"
                            : loan.dpd > 30
                            ? "text-amber-600"
                            : loan.dpd > 0
                            ? "text-orange-500"
                            : "text-gray-600"
                        }`}
                      >
                        {loan.dpd}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(loan.nextDueDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[loan.status]}>{loan.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/loans/${loan.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
