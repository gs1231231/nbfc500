"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Filter, Edit2, ToggleLeft, ToggleRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockBRERules } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import type { BRERule } from "@/lib/api";

const ACTION_COLORS = {
  APPROVE: "success",
  REJECT: "destructive",
  REFER: "warning",
} as const;

const CATEGORIES = ["ALL", "Credit Score", "Income", "Eligibility", "Credit History", "Business", "Collateral"];
const PRODUCTS = ["ALL", "Personal Loan", "Business Loan", "Home Loan", "Gold Loan", "Two-Wheeler Loan"];

const emptyRule: Partial<BRERule> = {
  name: "",
  description: "",
  product: "Personal Loan",
  category: "Credit Score",
  condition: "",
  action: "REJECT",
  priority: 1,
  active: true,
};

export default function BRERulesPage() {
  const [rules, setRules] = useState<BRERule[]>([]);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterProduct, setFilterProduct] = useState("ALL");
  const [filterActive, setFilterActive] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<BRERule>>(emptyRule);
  const [isEdit, setIsEdit] = useState(false);

  useEffect(() => {
    setRules(mockBRERules);
  }, []);

  const filtered = rules.filter((r) => {
    const matchSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description || "").toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === "ALL" || r.category === filterCategory;
    const matchProduct = filterProduct === "ALL" || r.product === filterProduct || r.product === "ALL";
    const matchActive =
      filterActive === "ALL" ||
      (filterActive === "ACTIVE" && r.active) ||
      (filterActive === "INACTIVE" && !r.active);
    return matchSearch && matchCategory && matchProduct && matchActive;
  });

  const openCreate = () => {
    setEditingRule(emptyRule);
    setIsEdit(false);
    setModalOpen(true);
  };

  const openEdit = (rule: BRERule) => {
    setEditingRule({ ...rule });
    setIsEdit(true);
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!editingRule.name || !editingRule.condition) return;

    if (isEdit && editingRule.id) {
      setRules((prev) =>
        prev.map((r) => (r.id === editingRule.id ? { ...r, ...editingRule } as BRERule : r))
      );
    } else {
      const newRule: BRERule = {
        ...emptyRule,
        ...editingRule,
        id: `r${Date.now()}`,
        createdAt: new Date().toISOString(),
      } as BRERule;
      setRules((prev) => [...prev, newRule]);
    }
    setModalOpen(false);
  };

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">BRE Rules</h1>
          <p className="text-sm text-gray-500 mt-1">
            {rules.filter((r) => r.active).length} active rules
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create Rule
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search rules..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-gray-400" />
              <Select
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                className="w-40"
              >
                {PRODUCTS.map((p) => (
                  <option key={p} value={p}>{p === "ALL" ? "All Products" : p}</option>
                ))}
              </Select>
              <Select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-40"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c === "ALL" ? "All Categories" : c}</option>
                ))}
              </Select>
              <Select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                className="w-32"
              >
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-400 py-12">
                    No rules found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <p className="font-medium text-gray-900">{rule.name}</p>
                      {rule.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">
                          {rule.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{rule.product}</Badge>
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm">{rule.category}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-mono">
                        {rule.condition}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ACTION_COLORS[rule.action]}>{rule.action}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">{rule.priority}</TableCell>
                    <TableCell>
                      {rule.active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDate(rule.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(rule)}
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleRule(rule.id)}
                          title={rule.active ? "Deactivate" : "Activate"}
                        >
                          {rule.active ? (
                            <ToggleRight className="h-5 w-5 text-green-500" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-gray-400" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEdit ? "Edit Rule" : "Create Rule"}
        description="Configure the BRE rule condition and action"
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Rule Name *</label>
              <Input
                value={editingRule.name || ""}
                onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                placeholder="e.g. Minimum CIBIL Score"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <Input
                value={editingRule.description || ""}
                onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                placeholder="Brief description of this rule"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Product *</label>
              <Select
                value={editingRule.product || "Personal Loan"}
                onChange={(e) => setEditingRule({ ...editingRule, product: e.target.value })}
              >
                {PRODUCTS.filter((p) => p !== "ALL").map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
                <option value="ALL">ALL Products</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Category *</label>
              <Select
                value={editingRule.category || "Credit Score"}
                onChange={(e) => setEditingRule({ ...editingRule, category: e.target.value })}
              >
                {CATEGORIES.filter((c) => c !== "ALL").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Condition Expression *
              </label>
              <textarea
                value={editingRule.condition || ""}
                onChange={(e) => setEditingRule({ ...editingRule, condition: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="e.g. bureau.cibil_score >= 700"
              />
              <p className="mt-1 text-xs text-gray-400">
                Use dot notation: bureau.*, applicant.*, business.*, loan.*
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Action *</label>
              <Select
                value={editingRule.action || "REJECT"}
                onChange={(e) =>
                  setEditingRule({
                    ...editingRule,
                    action: e.target.value as BRERule["action"],
                  })
                }
              >
                <option value="APPROVE">APPROVE</option>
                <option value="REJECT">REJECT</option>
                <option value="REFER">REFER</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={editingRule.priority || 1}
                onChange={(e) =>
                  setEditingRule({ ...editingRule, priority: parseInt(e.target.value) || 1 })
                }
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Active</label>
              <button
                type="button"
                onClick={() => setEditingRule({ ...editingRule, active: !editingRule.active })}
                className="flex items-center"
              >
                {editingRule.active ? (
                  <ToggleRight className="h-6 w-6 text-green-500" />
                ) : (
                  <ToggleLeft className="h-6 w-6 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!editingRule.name || !editingRule.condition}
            >
              {isEdit ? "Save Changes" : "Create Rule"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
