"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Save, Edit, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { Category } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import {
  addCategory,
  updateCategory,
  deleteCategory,
  addCategoryOption,
  deleteCategoryOption,
  getCategories,
} from "../actions";

interface LoadingStates {
  savingCategory: string | null;
  deletingCategory: string | null;
  addingOption: string | null;
  deletingOption: { categoryId: string; option: string } | null;
}

export default function CategoryEditor() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newOptions, setNewOptions] = useState<Record<string, string>>({});
  const [tempCategory, setTempCategory] = useState<Category | null>(null);
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    savingCategory: null,
    deletingCategory: null,
    addingOption: null,
    deletingOption: null,
  });
  const { toast } = useToast();

  // Ref for the new category
  const newCategoryRef = useRef<HTMLDivElement>(null);

  // Helper to cancel operation (UI-only)
  const cancelOperation = (
    operationType: keyof LoadingStates,
    key?: string
  ) => {
    setLoadingStates((prev) => ({
      ...prev,
      [operationType]: null,
    }));

    // If cancelling edit, also reset editing state
    if (operationType === "savingCategory") {
      setEditingCategory(null);
      setTempCategory(null);
    }
  };

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const loadedCategories = await getCategories();
        setCategories(loadedCategories);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load categories",
          variant: "destructive",
        });
      }
    };

    loadCategories();
  }, [toast]);

  // Effect to scroll to new category when it's created
  useEffect(() => {
    if (editingCategory && newCategoryRef.current) {
      newCategoryRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [editingCategory]);

  const handleAddCategory = () => {
    const newCategory: Category = {
      id: uuidv4(),
      name: "New Category",
      options: [],
    };
    setTempCategory(newCategory);
    setEditingCategory(newCategory.id);
  };

  const handleEditCategory = (categoryId: string) => {
    setEditingCategory(categoryId);
  };

  const handleSaveCategory = async (categoryId: string, newName: string) => {
    if (!newName.trim()) return;

    setLoadingStates((prev) => ({ ...prev, savingCategory: categoryId }));

    try {
      if (tempCategory && categoryId === tempCategory.id) {
        // This is a new category
        const newCategory = { ...tempCategory, name: newName };
        await addCategory(newCategory);
        setCategories([...categories, newCategory]);
        setTempCategory(null);
      } else {
        // This is an existing category
        await updateCategory(categoryId, { name: newName });
        setCategories(
          categories.map((cat) =>
            cat.id === categoryId ? { ...cat, name: newName } : cat
          )
        );
      }

      setEditingCategory(null);
      toast({
        title: "Category saved",
        description: "Category has been saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save category",
        variant: "destructive",
      });
    } finally {
      setLoadingStates((prev) => ({ ...prev, savingCategory: null }));
    }
  };

  const handleCancelEdit = () => {
    cancelOperation("savingCategory");
  };

  const handleDeleteCategory = async (categoryId: string) => {
    setLoadingStates((prev) => ({ ...prev, deletingCategory: categoryId }));

    try {
      await deleteCategory(categoryId);
      setCategories(categories.filter((cat) => cat.id !== categoryId));
      toast({
        title: "Category deleted",
        description: "Category has been deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    } finally {
      setLoadingStates((prev) => ({ ...prev, deletingCategory: null }));
    }
  };

  const handleAddOption = async (categoryId: string) => {
    const newOption = newOptions[categoryId];
    if (!newOption?.trim()) return;

    setLoadingStates((prev) => ({ ...prev, addingOption: categoryId }));

    try {
      await addCategoryOption(categoryId, newOption);
      setCategories(
        categories.map((cat) =>
          cat.id === categoryId
            ? { ...cat, options: [...cat.options, newOption] }
            : cat
        )
      );
      setNewOptions({
        ...newOptions,
        [categoryId]: "",
      });
      toast({
        title: "Option added",
        description: "New option has been added successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to add option",
        variant: "destructive",
      });
    } finally {
      setLoadingStates((prev) => ({ ...prev, addingOption: null }));
    }
  };

  const handleDeleteOption = async (categoryId: string, option: string) => {
    setLoadingStates((prev) => ({
      ...prev,
      deletingOption: { categoryId, option },
    }));

    try {
      await deleteCategoryOption(categoryId, option);
      setCategories(
        categories.map((cat) =>
          cat.id === categoryId
            ? { ...cat, options: cat.options.filter((opt) => opt !== option) }
            : cat
        )
      );
      toast({
        title: "Option deleted",
        description: "Option has been deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete option",
        variant: "destructive",
      });
    } finally {
      setLoadingStates((prev) => ({ ...prev, deletingOption: null }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Document Categories</h3>
        <Button size="sm" onClick={handleAddCategory}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-4">
        {categories.map((category) => (
          <div
            key={category.id}
            className="pb-3 border-b border-slate-100 dark:border-slate-800 last:border-0"
            ref={editingCategory === category.id ? newCategoryRef : null}
          >
            <div className="flex items-center justify-between mb-2">
              {editingCategory === category.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={category.name}
                    onChange={(e) => {
                      if (tempCategory && category.id === tempCategory.id) {
                        setTempCategory({
                          ...tempCategory,
                          name: e.target.value,
                        });
                      } else {
                        setCategories(
                          categories.map((cat) =>
                            cat.id === category.id
                              ? { ...cat, name: e.target.value }
                              : cat
                          )
                        );
                      }
                    }}
                    className="h-7 text-sm"
                    autoFocus
                    disabled={loadingStates.savingCategory === category.id}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      handleSaveCategory(category.id, category.name)
                    }
                    disabled={loadingStates.savingCategory === category.id}
                    className="h-7 w-7 p-0"
                  >
                    {loadingStates.savingCategory === category.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    className="h-7 w-7 p-0"
                    title={
                      loadingStates.savingCategory === category.id
                        ? "Cancel operation"
                        : "Cancel edit"
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <h4 className="font-medium text-sm">{category.name}</h4>
                  <div className="flex items-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditCategory(category.id)}
                      disabled={loadingStates.deletingCategory === category.id}
                      className="h-7 w-7 p-0"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteCategory(category.id)}
                      disabled={loadingStates.deletingCategory === category.id}
                      className="h-7 w-7 p-0"
                    >
                      {loadingStates.deletingCategory === category.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    {loadingStates.deletingCategory === category.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cancelOperation("deletingCategory")}
                        className="h-7 w-7 p-0 ml-1"
                        title="Cancel deletion"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-1 mb-2">
              {category.options.map((option, index) => {
                const isDeleting =
                  loadingStates.deletingOption?.categoryId === category.id &&
                  loadingStates.deletingOption?.option === option;

                return (
                  <Badge
                    key={`${category.id}-${option}-${index}`}
                    variant="outline"
                    className="flex items-center gap-1 px-2 py-0.5 group"
                  >
                    {option}
                    <div className="flex items-center ml-1">
                      {isDeleting ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          <button
                            onClick={() =>
                              cancelOperation(
                                "deletingOption",
                                `${category.id}-${option}`
                              )
                            }
                            className="hover:bg-destructive/10 rounded"
                            title="Cancel deletion"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() =>
                            handleDeleteOption(category.id, option)
                          }
                          className="opacity-0 group-hover:opacity-100"
                          disabled={isDeleting}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </Badge>
                );
              })}

              <div className="flex items-center">
                <Input
                  placeholder="New option"
                  value={newOptions[category.id] || ""}
                  onChange={(e) =>
                    setNewOptions({
                      ...newOptions,
                      [category.id]: e.target.value,
                    })
                  }
                  className="h-6 text-xs min-w-[100px] max-w-[150px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newOptions[category.id]?.trim()) {
                      handleAddOption(category.id);
                    }
                  }}
                  disabled={loadingStates.addingOption === category.id}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAddOption(category.id)}
                  disabled={
                    !newOptions[category.id]?.trim() ||
                    loadingStates.addingOption === category.id
                  }
                  className="h-6 w-6 p-0 ml-1"
                >
                  {loadingStates.addingOption === category.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                </Button>
                {loadingStates.addingOption === category.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => cancelOperation("addingOption")}
                    className="h-6 w-6 p-0 ml-1"
                    title="Cancel adding option"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}

        {tempCategory && editingCategory === tempCategory.id && (
          <div
            className="pb-3 border-b border-slate-100 dark:border-slate-800"
            ref={newCategoryRef}
          >
            <div className="flex items-center gap-2 mb-2">
              <Input
                value={tempCategory.name}
                onChange={(e) =>
                  setTempCategory({ ...tempCategory, name: e.target.value })
                }
                className="h-7 text-sm"
                autoFocus
                disabled={loadingStates.savingCategory === tempCategory.id}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  handleSaveCategory(tempCategory.id, tempCategory.name)
                }
                disabled={loadingStates.savingCategory === tempCategory.id}
                className="h-7 w-7 p-0"
              >
                {loadingStates.savingCategory === tempCategory.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelEdit}
                className="h-7 w-7 p-0"
                title={
                  loadingStates.savingCategory === tempCategory.id
                    ? "Cancel operation"
                    : "Cancel edit"
                }
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
