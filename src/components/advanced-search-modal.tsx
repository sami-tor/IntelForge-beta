"use client"

import { useState, useMemo } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { getAccessibleCategories } from "@/lib/categories"
import { useAuth } from "@/lib/auth-context"

interface AdvancedSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (filters: AdvancedFilters) => void
}

export interface AdvancedFilters {
  sortOrder: "most_relevant" | "least_relevant" | "newest" | "oldest"
  categories: string[]
  regions: string[]
  dateFrom?: string
  dateTo?: string
  mediaFilter: string
  groupSimilar: boolean
  phonebookFilter: "all" | "domains" | "emails" | "urls"
}

export function AdvancedSearchModal({ isOpen, onClose, onApply }: AdvancedSearchModalProps) {
  const { user } = useAuth()
  const userType = user?.subscriptionType || "free"

  const [filters, setFilters] = useState<AdvancedFilters>({
    sortOrder: "most_relevant",
    categories: [],
    regions: [],
    mediaFilter: "none",
    groupSimilar: false,
    phonebookFilter: "all",
  })

  const [activeTab, setActiveTab] = useState<"sort" | "categories" | "date">("sort")

  // Get accessible categories based on user type
  const accessibleCategories = useMemo(() => {
    return getAccessibleCategories(userType)
  }, [userType])

  const regionOptions = [
    "North Korea",
    "Ukraine",
    "Germany",
    ".com",
    ".org",
    ".net",
    ".info",
    ".eu",
    "China",
    "Northern Europe",
    "Western Europe",
    "Central and Eastern Europe",
    "Americas",
    "Africa",
    "Middle East and Asia",
    "Oceania",
    "Technology",
    "Business",
    "Social",
    "Misc",
    "Decentralized TLDs",
    "Government US",
    "Government Russia",
  ]

  const handleApply = () => {
    onApply(filters)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Advanced Search</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex gap-4 mb-6 border-b border-border">
            <button
              onClick={() => setActiveTab("sort")}
              className={`pb-2 px-4 text-sm font-medium transition-colors ${
                activeTab === "sort"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sort Order
            </button>
            <button
              onClick={() => setActiveTab("categories")}
              className={`pb-2 px-4 text-sm font-medium transition-colors ${
                activeTab === "categories"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Categories
            </button>
            <button
              onClick={() => setActiveTab("date")}
              className={`pb-2 px-4 text-sm font-medium transition-colors ${
                activeTab === "date"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Date
            </button>
          </div>

          {activeTab === "sort" && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Sort Order</h3>
                <div className="space-y-2">
                  {[
                    { value: "most_relevant", label: "Most Relevant" },
                    { value: "least_relevant", label: "Least Relevant" },
                    { value: "newest", label: "Newest" },
                    { value: "oldest", label: "Oldest" },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="sortOrder"
                        value={option.value}
                        checked={filters.sortOrder === option.value}
                        onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value as any })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Misc</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={filters.groupSimilar}
                    onCheckedChange={(checked) => setFilters({ ...filters, groupSimilar: checked as boolean })}
                  />
                  <span className="text-sm">Group Similar Results</span>
                </label>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Phonebook</h3>
                <div className="space-y-2">
                  {[
                    { value: "all", label: "All" },
                    { value: "domains", label: "Domains" },
                    { value: "emails", label: "Email Addresses" },
                    { value: "urls", label: "URLs" },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="phonebook"
                        value={option.value}
                        checked={filters.phonebookFilter === option.value}
                        onChange={(e) => setFilters({ ...filters, phonebookFilter: e.target.value as any })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "categories" && (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-3">Categories</h3>
                <div className="space-y-2">
                  {accessibleCategories.map((category) => (
                    <label key={category.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filters.categories.includes(category.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilters({ ...filters, categories: [...filters.categories, category.id] })
                          } else {
                            setFilters({ ...filters, categories: filters.categories.filter((c) => c !== category.id) })
                          }
                        }}
                      />
                      <span className="text-sm">{category.label}</span>
                      {category.pro && (
                        <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">PRO</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Public Web</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {regionOptions.map((region) => (
                    <label key={region} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filters.regions.includes(region)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilters({ ...filters, regions: [...filters.regions, region] })
                          } else {
                            setFilters({ ...filters, regions: filters.regions.filter((r) => r !== region) })
                          }
                        }}
                      />
                      <span className="text-sm">{region}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "date" && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateFrom" className="mb-2 block">
                    From
                  </Label>
                  <input
                    type="date"
                    id="dateFrom"
                    value={filters.dateFrom || ""}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    className="w-full h-10 px-3 border border-border rounded-md bg-background"
                  />
                </div>
                <div>
                  <Label htmlFor="dateTo" className="mb-2 block">
                    To
                  </Label>
                  <input
                    type="date"
                    id="dateTo"
                    value={filters.dateTo || ""}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    className="w-full h-10 px-3 border border-border rounded-md bg-background"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Both date from and date to must be selected for filter to work
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply Filters</Button>
        </div>
      </div>
    </div>
  )
}
