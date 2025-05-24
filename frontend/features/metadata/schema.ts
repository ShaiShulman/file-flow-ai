import { z } from "zod";

export const metadataSchema = z.object({
  category: z.string().optional(),
  title: z.string().optional(),
  date: z
    .string()
    .refine((val) => {
      if (!val) return true; // Allow empty
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Invalid date format")
    .optional(),
  subject: z.string().optional(),
  summary: z.string().optional(),
  custom_metadata: z.record(z.string(), z.string()).optional(),
  last_analyzed: z.string().optional(),
});

export type FileMetadata = z.infer<typeof metadataSchema>;
