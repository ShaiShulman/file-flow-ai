import type { ChangeRecord } from "@/lib/types"

// Mock changes data
export const mockChanges: ChangeRecord[] = [
  {
    id: "change1",
    type: "add",
    path: "/Incorporation Documents/Certificate of Incorporation.pdf",
    timestamp: new Date(Date.now() - 3600000), // 1 hour ago
  },
  {
    id: "change2",
    type: "modify",
    path: "/Incorporation Documents/Articles of Incorporation.pdf",
    timestamp: new Date(Date.now() - 7200000), // 2 hours ago
    details: "Updated metadata",
  },
  {
    id: "change3",
    type: "rename",
    path: "/Compliance/Policies/Privacy Policy.docx",
    timestamp: new Date(Date.now() - 86400000), // 1 day ago
    details: "Renamed from 'Privacy Guidelines.docx'",
  },
  {
    id: "change4",
    type: "delete",
    path: "/Legal Briefs/Old Case.docx",
    timestamp: new Date(Date.now() - 172800000), // 2 days ago
  },
  {
    id: "change5",
    type: "copy",
    path: "/Compliance/Regulatory Guidelines.pdf",
    timestamp: new Date(Date.now() - 259200000), // 3 days ago
    details: "Copied from '/Templates/Guidelines.pdf'",
  },
]
