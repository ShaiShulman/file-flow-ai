"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Save, Edit, Trash2 } from "lucide-react";
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

export default function CategoryEditor() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newOptions, setNewOptions] = useState<Record<string, string>>({});
  const [tempCategory, setTempCategory] = useState<Category | null>(null);
  const { toast } = useToast();

  // Ref for the new category
  const newCategoryRef = useRef<HTMLDivElement>(null);

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

    try {
      if (tempCategory && categoryId === tempCategory.id) {
        // This is a new category
        await addCategory({ ...tempCategory, name: newName });
        setCategories([...categories, { ...tempCategory, name: newName }]);
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
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save category",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setTempCategory(null);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      await deleteCategory(categoryId);
      setCategories(categories.filter((cat) => cat.id !== categoryId));
      toast({
        title: "Category deleted",
        description: "Category has been deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    }
  };

  const handleAddOption = async (categoryId: string) => {
    const newOption = newOptions[categoryId];
    if (!newOption?.trim()) return;

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
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add option",
        variant: "destructive",
      });
    }
  };

  const handleDeleteOption = async (categoryId: string, option: string) => {
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
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete option",
        variant: "destructive",
      });
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
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      handleSaveCategory(category.id, category.name)
                    }
                    className="h-7 w-7 p-0"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    className="h-7 w-7 p-0"
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
                      className="h-7 w-7 p-0"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteCategory(category.id)}
                      className="h-7 w-7 p-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-1 mb-2">
              {category.options.map((option) => (
                <Badge
                  key={option}
                  variant="outline"
                  className="flex items-center gap-1 px-2 py-0.5 group"
                >
                  {option}
                  <button
                    onClick={() => handleDeleteOption(category.id, option)}
                    className="opacity-0 group-hover:opacity-100 ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}

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
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAddOption(category.id)}
                  disabled={!newOptions[category.id]?.trim()}
                  className="h-6 w-6 p-0 ml-1"
                >
                  <Plus className="h-3 w-3" />
                </Button>
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
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  handleSaveCategory(tempCategory.id, tempCategory.name)
                }
                className="h-7 w-7 p-0"
              >
                <Save className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelEdit}
                className="h-7 w-7 p-0"
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
