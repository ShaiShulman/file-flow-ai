"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, Plus, Trash2, Undo2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { FileType } from "@/lib/types";
import { FileMetadata, metadataSchema } from "../schema";
import { getCategories } from "@/features/categories/actions";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";

interface MetadataEditorProps {
  selectedFile: FileType | null;
}

export default function MetadataEditor({ selectedFile }: MetadataEditorProps) {
  const [fileMetadata, setFileMetadata] = useState<FileMetadata>({});
  const [savedMetadata, setSavedMetadata] = useState<FileMetadata>({});
  const [newMetadataKey, setNewMetadataKey] = useState("");
  const [newMetadataValue, setNewMetadataValue] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    []
  );
  const [dateError, setDateError] = useState<string>("");
  const { toast } = useToast();

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (error) {
        console.error("Failed to load categories:", error);
        toast({
          title: "Error",
          description: "Failed to load categories",
          variant: "destructive",
        });
      }
    };
    loadCategories();
  }, [toast]);

  // Update metadata when selected file changes
  useEffect(() => {
    if (selectedFile) {
      const metadata = selectedFile.metadata || {};
      setFileMetadata(metadata);
      setSavedMetadata(metadata);
    } else {
      setFileMetadata({});
      setSavedMetadata({});
    }
  }, [selectedFile]);

  const handleSaveMetadata = async () => {
    if (!selectedFile) return;

    try {
      // Validate metadata
      metadataSchema.parse(fileMetadata);

      // TODO: Implement save functionality
      setSavedMetadata(fileMetadata);
      toast({
        title: "Metadata saved",
        description: `Updated metadata for ${selectedFile.name}`,
      });
    } catch (error) {
      toast({
        title: "Validation Error",
        description: "Please check your metadata values",
        variant: "destructive",
      });
    }
  };

  const handleUndo = () => {
    setFileMetadata(savedMetadata);
    setDateError("");
  };

  const handleAddCustomMetadata = () => {
    if (!newMetadataKey.trim() || !selectedFile) return;

    setFileMetadata({
      ...fileMetadata,
      custom_metadata: {
        ...(fileMetadata.custom_metadata || {}),
        [newMetadataKey]: newMetadataValue,
      },
    });

    setNewMetadataKey("");
    setNewMetadataValue("");
  };

  const handleDeleteCustomMetadata = (key: string) => {
    if (!selectedFile) return;

    const updatedCustomMetadata = { ...fileMetadata.custom_metadata };
    delete updatedCustomMetadata[key];

    setFileMetadata({
      ...fileMetadata,
      custom_metadata: updatedCustomMetadata,
    });
  };

  const validateDate = (date: string) => {
    if (!date) {
      setDateError("");
      return true;
    }
    const isValid = !isNaN(new Date(date).getTime());
    setDateError(isValid ? "" : "Invalid date format");
    return isValid;
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setFileMetadata({ ...fileMetadata, date: newDate });
    validateDate(newDate);
  };

  const handleClearDate = () => {
    setFileMetadata({ ...fileMetadata, date: "" });
    setDateError("");
  };

  if (!selectedFile) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a file to view metadata
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium">File Metadata</h3>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleUndo}
            title="Undo changes"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSaveMetadata}
            title="Save changes"
          >
            <Save className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto pr-2">
          <Card className="mb-4">
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={fileMetadata.category || ""}
                  onValueChange={(value) =>
                    setFileMetadata({ ...fileMetadata, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={fileMetadata.title || ""}
                  onChange={(e) =>
                    setFileMetadata({ ...fileMetadata, title: e.target.value })
                  }
                  placeholder="Document title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <div className="relative">
                  <Input
                    id="date"
                    type="date"
                    value={fileMetadata.date || ""}
                    onChange={handleDateChange}
                    onBlur={(e) => validateDate(e.target.value)}
                  />
                  {fileMetadata.date && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={handleClearDate}
                      title="Clear date"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {dateError && (
                  <p className="text-sm text-destructive">{dateError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject Matter</Label>
                <Input
                  id="subject"
                  value={fileMetadata.subject || ""}
                  onChange={(e) =>
                    setFileMetadata({
                      ...fileMetadata,
                      subject: e.target.value,
                    })
                  }
                  placeholder="Brief subject matter description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  value={fileMetadata.summary || ""}
                  onChange={(e) =>
                    setFileMetadata({
                      ...fileMetadata,
                      summary: e.target.value,
                    })
                  }
                  placeholder="Document summary"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-end gap-2">
                <div className="space-y-1 flex-1">
                  <Input
                    placeholder="Key"
                    value={newMetadataKey}
                    onChange={(e) => setNewMetadataKey(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1 flex-1">
                  <Input
                    placeholder="Value"
                    value={newMetadataValue}
                    onChange={(e) => setNewMetadataValue(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleAddCustomMetadata}
                  disabled={!newMetadataKey.trim()}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {Object.entries(fileMetadata.custom_metadata || {}).map(
                  ([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Badge variant="outline" className="flex-1">
                        {key}: {value}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCustomMetadata(key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          {fileMetadata.last_analyzed && (
            <div className="text-sm text-muted-foreground mt-4">
              Last analyzed:{" "}
              {format(new Date(fileMetadata.last_analyzed), "PPpp")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
