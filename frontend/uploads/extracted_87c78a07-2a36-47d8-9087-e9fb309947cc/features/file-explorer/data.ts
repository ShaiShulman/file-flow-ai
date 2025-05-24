import type { FolderType } from "@/lib/types"

// Sample data
export const sampleData: FolderType = {
  id: "root",
  name: "root",
  type: "folder",
  path: "/",
  children: [
    {
      id: "folder1",
      name: "Incorporation Documents",
      type: "folder",
      path: "/Incorporation Documents",
      children: [
        {
          id: "file1",
          name: "Certificate of Incorporation.pdf",
          type: "file",
          extension: "pdf",
          path: "/Incorporation Documents/Certificate of Incorporation.pdf",
          metadata: {
            category: "Incorporation",
            type: "Certificate",
            status: "Final",
            date: "2023-05-15",
          },
          changed: true,
        },
        {
          id: "file2",
          name: "Articles of Incorporation.pdf",
          type: "file",
          extension: "pdf",
          path: "/Incorporation Documents/Articles of Incorporation.pdf",
          metadata: {
            category: "Incorporation",
            type: "Articles",
            status: "Final",
            date: "2023-05-10",
          },
        },
        {
          id: "file3",
          name: "Deeds of Incorporation.pdf",
          type: "file",
          extension: "pdf",
          path: "/Incorporation Documents/Deeds of Incorporation.pdf",
          metadata: {
            category: "Incorporation",
            type: "Deeds",
            status: "Draft",
            date: "2023-05-20",
          },
          changed: true,
        },
      ],
    },
    {
      id: "folder2",
      name: "Legal Briefs",
      type: "folder",
      path: "/Legal Briefs",
      children: [
        {
          id: "file4",
          name: "Case Summary.docx",
          type: "file",
          extension: "docx",
          path: "/Legal Briefs/Case Summary.docx",
          metadata: {
            category: "Case Documents",
            type: "Summary",
            status: "Draft",
            assignee: "John Doe",
          },
        },
      ],
    },
    {
      id: "folder3",
      name: "Compliance",
      type: "folder",
      path: "/Compliance",
      children: [
        {
          id: "file5",
          name: "Regulatory Guidelines.pdf",
          type: "file",
          extension: "pdf",
          path: "/Compliance/Regulatory Guidelines.pdf",
          metadata: {
            category: "Compliance",
            type: "Guidelines",
            status: "Important",
            date: "2023-04-15",
          },
        },
        {
          id: "folder4",
          name: "Policies",
          type: "folder",
          path: "/Compliance/Policies",
          children: [
            {
              id: "file6",
              name: "Privacy Policy.docx",
              type: "file",
              extension: "docx",
              path: "/Compliance/Policies/Privacy Policy.docx",
              metadata: {
                category: "Policy",
                type: "Privacy",
                status: "Public",
                version: "2.1",
              },
              changed: true,
            },
          ],
        },
      ],
    },
  ],
}
