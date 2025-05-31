import path from "path";

export const UPLOAD_BASE_PATH =
  process.env.UPLOADS_FOLDER || path.join(process.cwd(), "uploads");
