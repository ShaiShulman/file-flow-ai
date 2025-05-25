"use client";

import type React from "react";

import { useState } from "react";
import { Upload, X, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { uploadAndExtractZip } from "@/lib/actions/folder-manager";
import type { FolderType } from "@/lib/types";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilesExtracted?: (
    folderName: string,
    files: FolderType,
    folderId: string
  ) => void;
}

export default function UploadDialog({
  open,
  onOpenChange,
  onFilesExtracted,
}: UploadDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith(".zip")) {
      setFile(droppedFile);
    } else {
      toast({
        title: "Invalid file",
        description: "Please upload a ZIP file",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith(".zip")) {
      setFile(selectedFile);
    } else if (selectedFile) {
      toast({
        title: "Invalid file",
        description: "Please upload a ZIP file",
        variant: "destructive",
      });
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const { folder, folderId } = await uploadAndExtractZip(file);

      setUploadProgress(100);

      if (onFilesExtracted) {
        onFilesExtracted(folder.name, folder, folderId);
      }

      setFile(null);
      setIsUploading(false);
      onOpenChange(false);

      toast({
        title: "Upload complete",
        description:
          "Your ZIP file has been uploaded and processed successfully",
      });
    } catch (err) {
      setUploadProgress(0);
      toast({
        title: "Upload failed",
        description:
          err instanceof Error
            ? err.message
            : "An error occurred while processing the file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Legal Documents</DialogTitle>
          <DialogDescription>
            Upload a ZIP file containing your legal documents for categorization
          </DialogDescription>
        </DialogHeader>

        <div
          className={`mt-4 border-2 border-dashed rounded-lg p-6 text-center ${
            isDragging
              ? "border-primary bg-primary/10"
              : "border-muted-foreground/25"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {file ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center">
                <FileUp className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              {isUploading && (
                <Progress value={uploadProgress} className="h-2 w-full" />
              )}
              {!isUploading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="mt-2"
                >
                  <X className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center">
                <Upload className="h-8 w-8 text-muted-foreground mb-4" />
              </div>
              <p className="text-sm font-medium">
                Drag and drop your ZIP file here
              </p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                or click to browse
              </p>
              <input
                type="file"
                id="file-upload"
                accept=".zip"
                className="hidden"
                onChange={handleFileChange}
              />
              <label htmlFor="file-upload">
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  asChild
                >
                  <span>Browse Files</span>
                </Button>
              </label>
            </>
          )}
        </div>

        <DialogFooter className="sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || isUploading}>
            {isUploading ? (
              <>
                <span className="animate-spin mr-1">⏳</span>
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
