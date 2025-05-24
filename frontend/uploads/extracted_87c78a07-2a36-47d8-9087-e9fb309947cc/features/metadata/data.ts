import type { Category } from "@/lib/types"

// Initial categories data
export const initialCategories: Category[] = [
  {
    id: "cat1",
    name: "Employment",
    description: "Employment-related legal documents",
    options: ["Confidential", "Reviewed", "Draft", "Final"],
  },
  {
    id: "cat2",
    name: "Confidentiality",
    description: "Confidentiality agreements and related documents",
    options: ["Confidential", "Public", "Internal"],
  },
  {
    id: "cat3",
    name: "Case Documents",
    description: "Legal case files and related documents",
    options: ["Draft", "Final", "Confidential", "Exhibit"],
  },
  {
    id: "cat4",
    name: "Compliance",
    description: "Regulatory compliance documents",
    options: ["Important", "Archived", "Current"],
  },
  {
    id: "cat5",
    name: "Policy",
    description: "Company policies and procedures",
    options: ["Public", "Internal", "Draft", "Approved"],
  },
]
