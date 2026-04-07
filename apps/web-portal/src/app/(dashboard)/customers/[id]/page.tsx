"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, Clock, Loader2, Phone, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockCustomers, mockLoans, mockApplications } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Customer } from "@/lib/api";
import DynamicFormRenderer from "@/components/dynamic-form/DynamicFormRenderer";

const KYC_COLORS = {
  VERIFIED: "success",
  PENDING: "warning",
  REJECTED: "destructive",
} as const;

const KYC_ICON = {
  VERIFIED: CheckCircle,
  PENDING: Clock,
  REJECTED: XCircle,
};

const LOAN_STATUS_COLORS = {
  ACTIVE: "success",
  CLOSED: "secondary",
  NPA: "destructive",
  WRITTEN_OFF: "secondary",
} as const;

export default function CustomerDetailPage() {
  const params = useParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});

  useEffect(() => {
    const found = mockCustomers.find((c) => c.id === params.id);
    setCustomer(found || null);
    setLoading(false);
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Customer not found.</p>
        <Link href="/customers" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
          Back to customers
        </Link>
      </div>
    );
  }

  const KycIcon = KYC_ICON[customer.kycStatus];
  const customerLoans = mockLoans.filter((l) => l.customerId === customer.id);
  const customerApps = mockApplications.filter((a) => a.applicantPan === customer.pan);

  // Mock payments
  const payments = [
    { id: "p1", date: "2024-03-05", amount: 12500, loanNumber: "LN-2024-001", status: "SUCCESS" },
    { id: "p2", date: "2024-02-05", amount: 12500, loanNumber: "LN-2024-001", status: "SUCCESS" },
    { id: "p3", date: "2024-01-05", amount: 12500, loanNumber: "LN-2024-001", status: "SUCCESS" },
  ];

  // Mock bureau history
  const bureauHistory = [
    { date: "2024-03-10", score: 745, source: "CIBIL" },
    { date: "2024-01-15", score: 735, source: "CIBIL" },
    { date: "2023-10-20", score: 720, source: "CIBIL" },
  ];

  // Mock documents
  const documents = [
    { name: "PAN Card", type: "PAN", status: "VERIFIED", uploadedAt: "2024-01-10" },
    { name: "Aadhar Card", type: "AADHAR", status: "VERIFIED", uploadedAt: "2024-01-10" },
    { name: "Address Proof", type: "ADDRESS", status: "PENDING", uploadedAt: undefined },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <Link href="/customers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>

        <Card className="flex-1">
          <CardContent className="p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              {/* Customer info */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-700">
                  {customer.name.charAt(0)}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="font-mono text-sm text-gray-500">{customer.pan}</span>
                    <div className="flex items-center gap-1 text-gray-500">
                      <Phone className="h-3.5 w-3.5" />
                      <span className="text-sm">{customer.mobile}</span>
                    </div>
                    {customer.email && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="text-sm">{customer.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* KYC Badge */}
              <div className="flex flex-col items-end gap-2">
                <Badge
                  variant={KYC_COLORS[customer.kycStatus]}
                  className="flex items-center gap-1 text-sm px-3 py-1"
                >
                  <KycIcon className="h-3.5 w-3.5" />
                  KYC {customer.kycStatus}
                </Badge>
                <p className="text-xs text-gray-500">
                  Customer since {formatDate(customer.createdAt)}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-3 gap-4 border-t border-gray-100 pt-4">
              {[
                ["Total Loans", customer.totalLoans ?? 0],
                ["Active Loans", customer.activeLoans ?? 0],
                ["Loan Accounts", customerLoans.length],
              ].map(([label, value]) => (
                <div key={label as string} className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="loans">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="bureau">Bureau</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="custom-fields">Custom Fields</TabsTrigger>
        </TabsList>

        {/* Loans */}
        <TabsContent value="loans">
          <Card>
            <CardHeader>
              <CardTitle>Loan Accounts</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan Number</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>EMI</TableHead>
                    <TableHead>DPD</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerLoans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                        No loans found
                      </TableCell>
                    </TableRow>
                  ) : (
                    customerLoans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell>
                          <Link
                            href={`/loans/${loan.id}`}
                            className="font-mono text-xs text-blue-600 hover:underline"
                          >
                            {loan.loanNumber}
                          </Link>
                        </TableCell>
                        <TableCell>{loan.product}</TableCell>
                        <TableCell>{formatCurrency(loan.principalAmount)}</TableCell>
                        <TableCell>{formatCurrency(loan.outstandingAmount)}</TableCell>
                        <TableCell>{formatCurrency(loan.emiAmount)}</TableCell>
                        <TableCell>
                          <span className={loan.dpd > 0 ? "text-red-600 font-semibold" : "text-gray-600"}>
                            {loan.dpd}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={LOAN_STATUS_COLORS[loan.status]}>{loan.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Applications */}
        <TabsContent value="applications">
          <Card>
            <CardHeader>
              <CardTitle>Applications</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application #</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerApps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                        No applications found
                      </TableCell>
                    </TableRow>
                  ) : (
                    customerApps.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>
                          <Link
                            href={`/applications/${app.id}`}
                            className="font-mono text-xs text-blue-600 hover:underline"
                          >
                            {app.applicationNumber}
                          </Link>
                        </TableCell>
                        <TableCell>{app.product}</TableCell>
                        <TableCell>{formatCurrency(app.loanAmount)}</TableCell>
                        <TableCell>
                          <Badge>{app.status.replace(/_/g, " ")}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(app.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Loan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.date)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.loanNumber}</TableCell>
                      <TableCell>{formatCurrency(p.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="success">{p.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bureau History */}
        <TabsContent value="bureau">
          <Card>
            <CardHeader>
              <CardTitle>Bureau Score History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Bureau</TableHead>
                    <TableHead>Band</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bureauHistory.map((b, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{formatDate(b.date)}</TableCell>
                      <TableCell className="font-bold text-lg">{b.score}</TableCell>
                      <TableCell>{b.source}</TableCell>
                      <TableCell>
                        <Badge
                          variant={b.score >= 750 ? "success" : b.score >= 700 ? "default" : "warning"}
                        >
                          {b.score >= 750 ? "Excellent" : b.score >= 700 ? "Good" : "Fair"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Collection Tasks */}
        <TabsContent value="tasks">
          <Card>
            <CardContent className="py-12 text-center text-gray-400">
              No collection tasks for this customer.
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Fields */}
        <TabsContent value="custom-fields">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Custom Fields</CardTitle>
            </CardHeader>
            <CardContent>
              <DynamicFormRenderer
                entityType="CUSTOMER"
                initialValues={(customer as unknown as Record<string, unknown>)?.customFields as Record<string, unknown> | undefined}
                onChange={setCustomFields}
                readOnly={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Uploaded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{doc.name}</TableCell>
                      <TableCell className="font-mono text-xs text-gray-500">{doc.type}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            doc.status === "VERIFIED"
                              ? "success"
                              : doc.status === "PENDING"
                              ? "warning"
                              : "destructive"
                          }
                        >
                          {doc.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {doc.uploadedAt ? formatDate(doc.uploadedAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
