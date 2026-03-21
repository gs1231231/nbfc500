"use client";

import { useState } from "react";
import { Settings, Bell, Shield, Building, Users, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const settingsSections = [
  { id: "general", label: "General", icon: Settings },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "organization", label: "Organization", icon: Building },
  { id: "users", label: "Users & Roles", icon: Users },
  { id: "integrations", label: "Integrations", icon: Database },
];

const mockUsers = [
  { id: "u1", name: "Priya Sharma", email: "priya@bankos.in", role: "Credit Manager", status: "ACTIVE" },
  { id: "u2", name: "Amit Verma", email: "amit@bankos.in", role: "Credit Officer", status: "ACTIVE" },
  { id: "u3", name: "Rohit Mehta", email: "rohit@bankos.in", role: "Credit Officer", status: "ACTIVE" },
  { id: "u4", name: "Sneha Pillai", email: "sneha@bankos.in", role: "Operations", status: "INACTIVE" },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("general");
  const [orgName, setOrgName] = useState("BankOS NBFC Pvt. Ltd.");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your platform configuration</p>
      </div>

      <div className="flex gap-6 flex-wrap lg:flex-nowrap">
        {/* Sidebar */}
        <div className="w-full lg:w-56 flex-shrink-0">
          <Card>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {settingsSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${
                        activeSection === section.id
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {section.label}
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeSection === "general" && (
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Organization Name
                  </label>
                  <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Default Currency
                  </label>
                  <Input value="INR (Indian Rupee)" readOnly className="bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Timezone
                  </label>
                  <Input value="Asia/Kolkata (IST)" readOnly className="bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Date Format
                  </label>
                  <Input value="DD/MM/YYYY" readOnly className="bg-gray-50" />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSave}>
                    {saved ? "Saved!" : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "New application submitted", enabled: true },
                  { label: "Application status changed", enabled: true },
                  { label: "Document uploaded", enabled: false },
                  { label: "Bureau check completed", enabled: true },
                  { label: "Disbursement processed", enabled: true },
                  { label: "Collection task overdue", enabled: true },
                  { label: "Daily portfolio summary", enabled: false },
                ].map((n) => (
                  <div key={n.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700">{n.label}</span>
                    <div
                      className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${n.enabled ? "bg-blue-600" : "bg-gray-200"}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full mt-1 shadow transition-transform ${n.enabled ? "ml-5" : "ml-1"}`} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeSection === "users" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Users & Roles</CardTitle>
                <Button size="sm">Invite User</Button>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["Name", "Email", "Role", "Status", "Actions"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {mockUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                        <td className="px-4 py-3 text-gray-600">{user.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">{user.role}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={user.status === "ACTIVE" ? "success" : "secondary"}>
                            {user.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="sm">Edit</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {activeSection === "security" && (
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Two-Factor Authentication", desc: "Require 2FA for all users", enabled: false },
                  { label: "Session Timeout", desc: "Auto-logout after 30 minutes of inactivity", enabled: true },
                  { label: "IP Allowlist", desc: "Restrict access to specific IP ranges", enabled: false },
                  { label: "Audit Log", desc: "Track all user actions", enabled: true },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${s.enabled ? "bg-blue-600" : "bg-gray-200"}`}>
                      <div className={`w-4 h-4 bg-white rounded-full mt-1 shadow transition-transform ${s.enabled ? "ml-5" : "ml-1"}`} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeSection === "organization" && (
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  ["NBFC Registration Number", "N-14.03217"],
                  ["RBI License Number", "B.02.00025"],
                  ["PAN", "AABCS1429B"],
                  ["GST Number", "27AABCS1429B1Z5"],
                  ["Registered Address", "101, Finance Tower, BKC, Mumbai - 400051"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                    <Input value={value} readOnly className="bg-gray-50" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeSection === "integrations" && (
            <Card>
              <CardHeader>
                <CardTitle>Integrations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: "CIBIL", type: "Bureau", status: "CONNECTED", color: "bg-green-100 text-green-800" },
                  { name: "Experian", type: "Bureau", status: "CONNECTED", color: "bg-green-100 text-green-800" },
                  { name: "CRIF", type: "Bureau", status: "DISCONNECTED", color: "bg-gray-100 text-gray-600" },
                  { name: "Digilocker", type: "KYC", status: "CONNECTED", color: "bg-green-100 text-green-800" },
                  { name: "NSDL PAN", type: "KYC", status: "CONNECTED", color: "bg-green-100 text-green-800" },
                  { name: "RazorpayX", type: "Payment", status: "CONNECTED", color: "bg-green-100 text-green-800" },
                  { name: "AWS S3", type: "Storage", status: "CONNECTED", color: "bg-green-100 text-green-800" },
                ].map((integration) => (
                  <div
                    key={integration.name}
                    className="flex items-center justify-between p-4 border border-gray-100 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Database className="h-5 w-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{integration.name}</p>
                        <p className="text-xs text-gray-500">{integration.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${integration.color}`}>
                        {integration.status}
                      </span>
                      <Button variant="outline" size="sm">Configure</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
