"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    key?: string,
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
            cat.id === categoryId ? { ...cat, name: newName } : cat,
          ),
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
            : cat,
        ),
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
            : cat,
        ),
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

  const renderCategoryCard = (category: Category, isTemp = false) => {
    const isEditing = editingCategory === category.id;
    const isSaving = loadingStates.savingCategory === category.id;
    const isDeleting = loadingStates.deletingCategory === category.id;

    return (
      <div
        key={category.id}
        ref={isEditing ? newCategoryRef : null}
        className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden"
      >
        {/* Card header */}
        <div className="flex items-center justify-between px-3 py-1 bg-violet-100 dark:bg-violet-900/20 border-b border-violet-200 dark:border-violet-800/30">
          {isEditing ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={category.name}
                onChange={(e) => {
                  if (isTemp && tempCategory) {
                    setTempCategory({ ...tempCategory, name: e.target.value });
                  } else {
                    setCategories(
                      categories.map((cat) =>
                        cat.id === category.id
                          ? { ...cat, name: e.target.value }
                          : cat,
                      ),
                    );
                  }
                }}
                className="h-7 text-sm bg-white dark:bg-stone-900 border-stone-300"
                autoFocus
                disabled={isSaving}
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    handleSaveCategory(category.id, category.name);
                  if (e.key === "Escape") handleCancelEdit();
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleSaveCategory(category.id, category.name)}
                disabled={isSaving}
                className="h-7 w-7 p-0 text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/30"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelEdit}
                className="h-7 w-7 p-0 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <>
              <h4 className="font-semibold text-xs text-stone-800 dark:text-stone-200">
                {category.name}
              </h4>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => handleEditCategory(category.id)}
                  disabled={isDeleting}
                  className="p-1 rounded text-stone-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-400 dark:hover:bg-violet-900/30 transition-colors"
                  title="Edit category"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteCategory(category.id)}
                  disabled={isDeleting}
                  className="p-1 rounded text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                  title="Delete category"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Card body — options as bubbles */}
        <div className="px-3 py-2 flex flex-wrap gap-1.5 ">
          {category.options.map((option, index) => {
            const optDeleting =
              loadingStates.deletingOption?.categoryId === category.id &&
              loadingStates.deletingOption?.option === option;

            return (
              <span
                key={`${category.id}-${option}-${index}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-xs text-stone-600 dark:text-stone-300 group transition-colors hover:bg-stone-200 dark:hover:bg-stone-700"
              >
                {option}
                {optDeleting ? (
                  <Loader2 className="h-3 w-3 animate-spin text-stone-400" />
                ) : (
                  <button
                    onClick={() => handleDeleteOption(category.id, option)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full text-stone-300 hover:text-red-400 dark:text-stone-500 dark:hover:text-red-400 transition-all"
                    title="Remove option"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            );
          })}

          {/* Dotted add-option input */}
          <Input
            placeholder="+ Add option..."
            value={newOptions[category.id] || ""}
            onChange={(e) =>
              setNewOptions({ ...newOptions, [category.id]: e.target.value })
            }
            className="h-5 text-xs w-28 bg-transparent border-dashed border-stone-300 dark:border-stone-600 rounded-full px-2 py-0.5 text-stone-500 dark:text-stone-400 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:border-violet-400 focus:bg-white dark:focus:bg-stone-900 focus:w-40 transition-all"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newOptions[category.id]?.trim()) {
                handleAddOption(category.id);
              }
            }}
            disabled={loadingStates.addingOption === category.id}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2.5">
      <div className="space-y-2.5">
        {categories.map((category) => renderCategoryCard(category))}
        {tempCategory &&
          editingCategory === tempCategory.id &&
          renderCategoryCard(tempCategory, true)}
      </div>

      <button
        type="button"
        onClick={handleAddCategory}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/30 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Category
      </button>
    </div>
  );
}
