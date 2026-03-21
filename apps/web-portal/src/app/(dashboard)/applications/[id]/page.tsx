"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockApplications } from "@/lib/mock-data";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Application, ApplicationStatus } from "@/lib/api";

const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  DRAFT: "secondary",
  SUBMITTED: "default",
  UNDER_REVIEW: "default",
  BUREAU_CHECK: "warning",
  BRE_CHECK: "warning",
  CREDIT_REVIEW: "warning",
  SANCTIONED: "success",
  DOCUMENTATION: "warning",
  DISBURSED: "success",
  REJECTED: "destructive",
  WITHDRAWN: "secondary",
};

const STATUS_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["BUREAU_CHECK", "REJECTED"],
  BUREAU_CHECK: ["BRE_CHECK", "REJECTED"],
  BRE_CHECK: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["CREDIT_REVIEW", "REJECTED"],
  CREDIT_REVIEW: ["SANCTIONED", "REJECTED"],
  SANCTIONED: ["DOCUMENTATION", "REJECTED"],
  DOCUMENTATION: ["DISBURSED", "REJECTED"],
  DISBURSED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

const DOC_STATUS_COLORS = {
  PENDING: "secondary",
  UPLOADED: "default",
  VERIFIED: "success",
  REJECTED: "destructive",
} as const;

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitionModal, setTransitionModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [newStatus, setNewStatus] = useState<ApplicationStatus | "">("");
  const [comment, setComment] = useState("");
  const [assignee, setAssignee] = useState("");

  useEffect(() => {
    const found = mockApplications.find((a) => a.id === params.id);
    setApp(found || null);
    setLoading(false);
  }, [params.id]);

  const handleTransition = () => {
    if (!app || !newStatus) return;
    setApp({ ...app, status: newStatus as ApplicationStatus });
    setTransitionModal(false);
    setNewStatus("");
    setComment("");
  };

  const handleAssign = () => {
    if (!app || !assignee) return;
    setApp({ ...app, assignedOfficer: assignee });
    setAssignModal(false);
    setAssignee("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Application not found.</p>
        <Link href="/applications" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
          Back to applications
        </Link>
      </div>
    );
  }

  const transitions = STATUS_TRANSITIONS[app.status] || [];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/applications">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{app.applicationNumber}</h1>
              <Badge variant={STATUS_COLORS[app.status]}>{app.status.replace(/_/g, " ")}</Badge>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{app.product} • {app.applicantName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAssignModal(true)}>
            <User className="h-4 w-4" />
            Assign Officer
          </Button>
          {transitions.length > 0 && (
            <Button onClick={() => setTransitionModal(true)}>
              <ChevronRight className="h-4 w-4" />
              Transition Status
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Application Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                Application Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                {[
                  ["Applicant Name", app.applicantName],
                  ["PAN Number", app.applicantPan],
                  ["Product", app.product],
                  ["Loan Amount", formatCurrency(app.loanAmount)],
                  ["DSA", app.dsaName || "Direct"],
                  ["Assigned Officer", app.assignedOfficer || "Unassigned"],
                  ["Days in Stage", `${app.daysInStage ?? 0} days`],
                  ["Bureau Score", app.bureauScore ? app.bureauScore.toString() : "N/A"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Bureau Summary */}
          {app.bureauScore && (
            <Card>
              <CardHeader>
                <CardTitle>Bureau Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  {/* Score circle */}
                  <div className="relative flex-shrink-0">
                    <svg className="h-28 w-28 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
                      <circle
                        cx="18"
                        cy="18"
                        r="15.9"
                        fill="none"
                        stroke={app.bureauScore >= 750 ? "#22c55e" : app.bureauScore >= 650 ? "#f59e0b" : "#ef4444"}
                        strokeWidth="2.5"
                        strokeDasharray={`${(app.bureauScore / 900) * 100} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-gray-900">{app.bureauScore}</span>
                      <span className="text-xs text-gray-400">CIBIL</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 flex-1">
                    {[
                      ["Score Band", app.bureauScore >= 750 ? "Excellent" : app.bureauScore >= 700 ? "Good" : app.bureauScore >= 650 ? "Fair" : "Poor"],
                      ["Active Accounts", "4"],
                      ["Overdue Accounts", "0"],
                      ["Total Enquiries (6M)", "2"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* BRE Decision */}
          {app.breDecision && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>BRE Decision</span>
                  <Badge
                    variant={
                      app.breDecision === "APPROVED"
                        ? "success"
                        : app.breDecision === "REJECTED"
                        ? "destructive"
                        : "warning"
                    }
                  >
                    {app.breDecision}
                  </Badge>
                </CardTitle>
              </CardHeader>
              {app.breRuleResults && (
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rule</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Threshold</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {app.breRuleResults.map((rule) => (
                        <TableRow key={rule.ruleId}>
                          <TableCell className="font-medium">{rule.ruleName}</TableCell>
                          <TableCell>{rule.value || "—"}</TableCell>
                          <TableCell className="text-gray-500">{rule.threshold || "—"}</TableCell>
                          <TableCell>
                            {rule.passed ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">Pass</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-red-600">
                                <XCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">Fail</span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          )}

          {/* Documents */}
          {app.documents && (
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
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {app.documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.name}</TableCell>
                        <TableCell className="text-gray-500 font-mono text-xs">{doc.type}</TableCell>
                        <TableCell>
                          <Badge variant={DOC_STATUS_COLORS[doc.status]}>{doc.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {doc.status === "UPLOADED" || doc.status === "VERIFIED" ? (
                            <Button variant="ghost" size="sm">View</Button>
                          ) : (
                            <Button variant="outline" size="sm">Upload</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column - Status Timeline */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-400" />
                Status History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {app.statusHistory && app.statusHistory.length > 0 ? (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />

                  <div className="space-y-6">
                    {[...app.statusHistory].reverse().map((entry, idx) => (
                      <div key={idx} className="flex gap-4 relative">
                        <div className={`h-6 w-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center z-10 ${
                          idx === 0 ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300"
                        }`}>
                          {idx === 0 && <div className="h-2 w-2 rounded-full bg-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {entry.status.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatDateTime(entry.timestamp)}
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            by {entry.actor}
                          </p>
                          {entry.comment && (
                            <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded px-2 py-1">
                              {entry.comment}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-6 text-gray-400 text-sm">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  No history available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transition Status Modal */}
      <Modal
        open={transitionModal}
        onClose={() => setTransitionModal(false)}
        title="Transition Status"
        description={`Move application ${app.applicationNumber} to a new status`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Status</label>
            <Select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as ApplicationStatus)}
            >
              <option value="">Select status...</option>
              {transitions.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Comment (optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Add a comment..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTransitionModal(false)}>Cancel</Button>
            <Button onClick={handleTransition} disabled={!newStatus}>Transition</Button>
          </div>
        </div>
      </Modal>

      {/* Assign Officer Modal */}
      <Modal
        open={assignModal}
        onClose={() => setAssignModal(false)}
        title="Assign Officer"
        description="Assign a credit officer to this application"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Officer</label>
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Select officer...</option>
              {["Priya Sharma", "Amit Verma", "Rohit Mehta", "Sneha Pillai"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAssignModal(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!assignee}>Assign</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
