"use client";

import { GitMerge, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";

const mockCoLendingDeals = [
  {
    id: "cl-001",
    loanNumber: "LN-2024-CL-001",
    customer: "Rajesh Kumar",
    product: "Home Loan",
    totalAmount: 5000000,
    ourShare: 2000000,
    partnerShare: 3000000,
    partnerBank: "SBI",
    status: "ACTIVE",
    disbursedAt: "2024-02-15",
  },
  {
    id: "cl-002",
    loanNumber: "LN-2024-CL-002",
    customer: "Sunita Patel",
    product: "Business Loan",
    totalAmount: 10000000,
    ourShare: 2000000,
    partnerShare: 8000000,
    partnerBank: "HDFC Bank",
    status: "PENDING",
    disbursedAt: "2024-03-01",
  },
  {
    id: "cl-003",
    loanNumber: "LN-2024-CL-003",
    customer: "Vikram Singh",
    product: "Home Loan",
    totalAmount: 7500000,
    ourShare: 1500000,
    partnerShare: 6000000,
    partnerBank: "Axis Bank",
    status: "ACTIVE",
    disbursedAt: "2024-01-20",
  },
];

export default function CoLendingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Co-Lending</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage co-lending arrangements with partner banks
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Total Co-Lending Book", value: formatCurrency(22500000) },
          { label: "Our Share", value: formatCurrency(5500000) },
          { label: "Partner Share", value: formatCurrency(17000000) },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-6">
              <p className="text-sm text-gray-500">{item.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Partner breakdown */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { bank: "SBI", deals: 1, amount: 5000000 },
          { bank: "HDFC Bank", deals: 1, amount: 10000000 },
          { bank: "Axis Bank", deals: 1, amount: 7500000 },
        ].map((partner) => (
          <Card key={partner.bank} className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <GitMerge className="h-4 w-4 text-blue-500" />
                <span className="font-semibold text-gray-900">{partner.bank}</span>
              </div>
              <p className="text-sm text-gray-500">{partner.deals} active deal(s)</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {formatCurrency(partner.amount)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Deals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Co-Lending Deals</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Our Share</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Partner Share</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Disbursed</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockCoLendingDeals.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell className="font-mono text-xs">{deal.loanNumber}</TableCell>
                  <TableCell className="font-medium text-gray-900">{deal.customer}</TableCell>
                  <TableCell className="text-gray-600">{deal.product}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(deal.totalAmount)}</TableCell>
                  <TableCell className="text-blue-600 font-medium">
                    {formatCurrency(deal.ourShare)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{deal.partnerBank}</Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(deal.partnerShare)}</TableCell>
                  <TableCell>
                    <Badge variant={deal.status === "ACTIVE" ? "success" : "warning"}>
                      {deal.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatDate(deal.disbursedAt)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      View <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
