import { Suspense } from "react";
import CategoryEditor from "./category-editor";
import LoadingSpinner from "@/components/ui/loading-spinner";

export default function CategoryEditorWrapper() {
  return (
    <Suspense fallback={<LoadingSpinner containerClassName="h-32" />}>
      <CategoryEditor />
    </Suspense>
  );
}
