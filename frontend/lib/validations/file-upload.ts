import { z } from "zod";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes

export const fileUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: "File size must be less than 20MB",
    })
    .refine(
      (file) => {
        // More lenient check for ZIP files
        return (
          file.name.toLowerCase().endsWith(".zip") ||
          file.type === "application/zip" ||
          file.type === "application/x-zip-compressed" ||
          file.type === "application/octet-stream"
        );
      },
      {
        message: "File must be a ZIP archive",
      }
    ),
});

export type FileUploadSchema = z.infer<typeof fileUploadSchema>;
