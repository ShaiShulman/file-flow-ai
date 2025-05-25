"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, X, Save, Edit, Trash2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import type { Category } from "@/lib/types"
import { initialCategories } from "@/features/metadata/data"

export default function CategoryEditor() {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [newOptions, setNewOptions] = useState<Record<string, string>>({})
  const { toast } = useToast()

  // Ref for the new category
  const newCategoryRef = useRef<HTMLDivElement>(null)

  // Effect to scroll to new category when it's created
  useEffect(() => {
    if (editingCategory && newCategoryRef.current) {
      newCategoryRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [editingCategory])

  const handleAddCategory = () => {
    const newCategory: Category = {
      id: `cat${Date.now()}`, // Use timestamp for unique ID
      name: "New Category",
      description: "Description for the new category",
      options: [],
    }

    setCategories([...categories, newCategory])
    setEditingCategory(newCategory.id) // Set to edit mode immediately
  }

  const handleEditCategory = (categoryId: string) => {
    setEditingCategory(categoryId)
  }

  const handleSaveCategory = (categoryId: string, newName: string) => {
    if (!newName.trim()) return

    setCategories(categories.map((cat) => (cat.id === categoryId ? { ...cat, name: newName } : cat)))

    setEditingCategory(null)
  }

  const handleDeleteCategory = (categoryId: string) => {
    setCategories(categories.filter((cat) => cat.id !== categoryId))
  }

  const handleAddOption = (categoryId: string) => {
    const newOption = newOptions[categoryId]
    if (!newOption?.trim()) return

    setCategories(
      categories.map((cat) => (cat.id === categoryId ? { ...cat, options: [...cat.options, newOption] } : cat)),
    )

    setNewOptions({
      ...newOptions,
      [categoryId]: "",
    })
  }

  const handleDeleteOption = (categoryId: string, option: string) => {
    setCategories(
      categories.map((cat) =>
        cat.id === categoryId ? { ...cat, options: cat.options.filter((opt) => opt !== option) } : cat,
      ),
    )
  }

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
                      setCategories(
                        categories.map((cat) => (cat.id === category.id ? { ...cat, name: e.target.value } : cat)),
                      )
                    }}
                    className="h-7 text-sm"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSaveCategory(category.id, category.name)}
                    className="h-7 w-7 p-0"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingCategory(null)} className="h-7 w-7 p-0">
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
                <Badge key={option} variant="outline" className="flex items-center gap-1 px-2 py-0.5 group">
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
                      handleAddOption(category.id)
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
      </div>
    </div>
  )
}
