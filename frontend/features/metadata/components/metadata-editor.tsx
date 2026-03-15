"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { FileType, MetadataField } from "@/lib/types";
import { apiClient } from "@/features/api/client";
import { useSessionContext } from "@/features/session/context";

interface MetadataEditorProps {
  selectedFile: FileType | null;
  sessionId: string | null;
}

export default function MetadataEditor({
  selectedFile,
  sessionId,
}: MetadataEditorProps) {
  const [metadata, setMetadata] = useState<Record<string, any>>({});
  const [savedMetadata, setSavedMetadata] = useState<Record<string, any>>({});
  const [fields, setFields] = useState<MetadataField[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { sessionState } = useSessionContext();

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await apiClient.getCategories();
        setCategories(Object.keys(cats));
      } catch (error) {
        console.error("Failed to load categories:", error);
      }
    };
    loadCategories();
  }, []);

  // Load metadata fields for session
  useEffect(() => {
    if (!sessionId) return;
    const loadFields = async () => {
      try {
        const result = await apiClient.getMetadataFields(sessionId);
        setFields(result.fields);
      } catch (error) {
        console.error("Failed to load metadata fields:", error);
      }
    };
    loadFields();
  }, [sessionId]);

  // Extract just the filename from a full path (handles both / and \)
  const getFileName = (filePath: string) => {
    const parts = filePath.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1];
  };

  // Load file metadata when file selection changes or new metadata arrives
  useEffect(() => {
    if (!selectedFile || !sessionId) {
      setMetadata({});
      setSavedMetadata({});
      return;
    }
    const fileName = getFileName(selectedFile.path);

    const loadMetadata = async () => {
      try {
        const result = await apiClient.getFileMetadata(
          sessionId,
          fileName
        );
        if (result.metadata && Object.keys(result.metadata).length > 0) {
          setMetadata(result.metadata);
          setSavedMetadata(result.metadata);
          return;
        }
      } catch (error) {
        // Backend failed, fall through to context metadata
      }

      // Fallback: use in-memory metadata from session context
      const contextMeta = sessionState.allFileMetadata[fileName];
      if (contextMeta && Object.keys(contextMeta).length > 0) {
        setMetadata(contextMeta);
        setSavedMetadata(contextMeta);
        return;
      }

      // Final fallback: use file's local metadata
      const localMeta = selectedFile.metadata || {};
      setMetadata(localMeta);
      setSavedMetadata(localMeta);
    };
    loadMetadata();
  }, [selectedFile, sessionId, sessionState.allFileMetadata]);

  // Auto-save with debounce
  const autoSave = useCallback(
    (newMetadata: Record<string, any>) => {
      if (!selectedFile || !sessionId) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        try {
          const fileName = getFileName(selectedFile.path);
          await apiClient.updateFileMetadata(
            sessionId,
            fileName,
            newMetadata
          );
          const previousSaved = { ...savedMetadata };
          setSavedMetadata(newMetadata);

          // Show undo toast
          const { dismiss } = toast({
            title: "Metadata saved",
            description: "Click undo to revert",
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMetadata(previousSaved);
                  setSavedMetadata(previousSaved);
                  apiClient
                    .updateFileMetadata(
                      sessionId,
                      fileName,
                      previousSaved
                    )
                    .catch(console.error);
                  dismiss();
                }}
              >
                Undo
              </Button>
            ),
            duration: 5000,
          });
        } catch (error) {
          console.error("Failed to save metadata:", error);
        }
      }, 500);
    },
    [selectedFile, sessionId, savedMetadata, toast]
  );

  const updateField = (key: string, value: any) => {
    const newMetadata = { ...metadata, [key]: value };
    setMetadata(newMetadata);
    autoSave(newMetadata);
  };

  const handleAddField = async () => {
    if (!newFieldName.trim() || !sessionId) return;
    try {
      await apiClient.addMetadataField(sessionId, newFieldName, newFieldType);
      setFields((prev) => [
        ...prev,
        { field_name: newFieldName, field_type: newFieldType },
      ]);
      setNewFieldName("");
      setNewFieldType("text");
    } catch (error) {
      console.error("Failed to add field:", error);
    }
  };

  const handleDeleteField = async (fieldName: string) => {
    if (!sessionId) return;
    try {
      await apiClient.deleteMetadataField(sessionId, fieldName);
      setFields((prev) => prev.filter((f) => f.field_name !== fieldName));
      // Remove from metadata
      const newMetadata = { ...metadata };
      delete newMetadata[fieldName];
      setMetadata(newMetadata);
      autoSave(newMetadata);
    } catch (error) {
      console.error("Failed to delete field:", error);
    }
  };

  if (!selectedFile) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a file to view metadata
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Upload files to edit metadata
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto pr-2 space-y-2">
          {/* Core fields */}
          <div className="space-y-2">
            <div className="flex items-center">
              <Label htmlFor="category" className="text-xs text-stone-500 w-[80px] shrink-0">
                Category
              </Label>
              <Select
                value={metadata.category || ""}
                onValueChange={(value) => updateField("category", value)}
              >
                <SelectTrigger className="h-8 border-stone-200">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center">
              <Label htmlFor="date" className="text-xs text-stone-500 w-[80px] shrink-0">
                Date
              </Label>
              <div className="relative flex-1">
                <Input
                  id="date"
                  type="date"
                  className="h-8 border-stone-200"
                  value={metadata.date || ""}
                  onChange={(e) => {
                    updateField("date", e.target.value);
                  }}
                />
                {metadata.date && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-0 top-0 h-full px-2"
                    onClick={() => updateField("date", "")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* User-defined fields */}
          {fields.length > 0 && (
            <div className="space-y-2 pt-1">
              {fields.map((field) => (
                <div key={field.field_name} className="flex items-start">
                  <div className="flex items-center w-[80px] shrink-0 pt-1.5">
                    <Label className="text-xs text-stone-500 truncate">{field.field_name}</Label>
                  </div>
                  <div className="flex-1">
                    {field.field_type === "textarea" ? (
                      <Textarea
                        value={metadata[field.field_name] || ""}
                        onChange={(e) =>
                          updateField(field.field_name, e.target.value)
                        }
                        rows={2}
                        className="text-sm border-stone-200"
                      />
                    ) : (
                      <Input
                        type={field.field_type === "date" ? "date" : "text"}
                        className="h-8 border-stone-200"
                        value={metadata[field.field_name] || ""}
                        onChange={(e) =>
                          updateField(field.field_name, e.target.value)
                        }
                      />
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 ml-1"
                    onClick={() => handleDeleteField(field.field_name)}
                  >
                    <Trash2 className="h-3 w-3 text-stone-400" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add new field */}
          <div className="flex items-end gap-2 pt-2 border-t border-stone-100">
            <div className="flex-1">
              <Input
                placeholder="Field name"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                className="h-8 text-sm border-stone-200"
              />
            </div>
            <Select value={newFieldType} onValueChange={setNewFieldType}>
              <SelectTrigger className="h-8 w-24 border-stone-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="textarea">Long text</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8"
              onClick={handleAddField}
              disabled={!newFieldName.trim()}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
