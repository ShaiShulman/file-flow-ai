"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { X, Plus, Save, Edit } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

// Types
type FileMetadata = {
  category?: string
  description?: string
  options?: string[]
}

type Category = {
  id: string
  name: string
  description: string
  options: string[]
}

// Mock data
const initialCategories: Category[] = [
  {
    id: "cat1",
    name: "Employment",
    description: "Employment-related legal documents",
    options: ["Confidential", "Reviewed", "Draft", "Final"],
  },
  {
    id: "cat2",
    name: "Confidentiality",
    description: "Confidentiality agreements and related documents",
    options: ["Confidential", "Public", "Internal"],
  },
  {
    id: "cat3",
    name: "Case Documents",
    description: "Legal case files and related documents",
    options: ["Draft", "Final", "Confidential", "Exhibit"],
  },
  {
    id: "cat4",
    name: "Compliance",
    description: "Regulatory compliance documents",
    options: ["Important", "Archived", "Current"],
  },
  {
    id: "cat5",
    name: "Policy",
    description: "Company policies and procedures",
    options: ["Public", "Internal", "Draft", "Approved"],
  },
]

export default function MetadataEditor() {
  const [activeTab, setActiveTab] = useState("file")
  const [selectedFile, setSelectedFile] = useState<any | null>(null)
  const [fileMetadata, setFileMetadata] = useState<FileMetadata>({})
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [newOption, setNewOption] = useState("")
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const { toast } = useToast()

  // Listen for file selection events
  useEffect(() => {
    const handleFileSelected = (event: CustomEvent) => {
      setSelectedFile(event.detail)
      setFileMetadata(event.detail.metadata || {})
      setActiveTab("file")
    }

    window.addEventListener("fileSelected", handleFileSelected as EventListener)

    return () => {
      window.removeEventListener("fileSelected", handleFileSelected as EventListener)
    }
  }, [])

  const handleSaveFileMetadata = () => {
    if (!selectedFile) return

    // In a real app, you would update the file metadata in your state or backend
    toast({
      title: "Metadata saved",
      description: `Updated metadata for ${selectedFile.name}`,
    })
  }

  const handleAddOption = (categoryId: string) => {
    if (!newOption.trim()) return

    setCategories(
      categories.map((cat) => (cat.id === categoryId ? { ...cat, options: [...cat.options, newOption] } : cat)),
    )

    setNewOption("")
  }

  const handleRemoveOption = (categoryId: string, option: string) => {
    setCategories(
      categories.map((cat) =>
        cat.id === categoryId ? { ...cat, options: cat.options.filter((opt) => opt !== option) } : cat,
      ),
    )
  }

  const handleEditCategory = (category: Category) => {
    setEditingCategory({ ...category })
  }

  const handleSaveCategory = () => {
    if (!editingCategory) return

    setCategories(categories.map((cat) => (cat.id === editingCategory.id ? editingCategory : cat)))

    setEditingCategory(null)

    toast({
      title: "Category updated",
      description: `Updated category: ${editingCategory.name}`,
    })
  }

  const handleAddCategory = () => {
    const newCategory: Category = {
      id: `cat${categories.length + 1}`,
      name: "New Category",
      description: "Description for the new category",
      options: [],
    }

    setCategories([...categories, newCategory])
    setEditingCategory(newCategory)
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="file" disabled={!selectedFile}>
          File Metadata
        </TabsTrigger>
        <TabsTrigger value="categories">Categories</TabsTrigger>
      </TabsList>

      <TabsContent value="file" className="space-y-4">
        {selectedFile ? (
          <Card>
            <CardHeader>
              <CardTitle>{selectedFile.name}</CardTitle>
              <CardDescription>Edit metadata for this file</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={fileMetadata.category || ""}
                  onValueChange={(value) => setFileMetadata({ ...fileMetadata, category: value })}
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
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={fileMetadata.description || ""}
                  onChange={(e) => setFileMetadata({ ...fileMetadata, description: e.target.value })}
                  placeholder="Enter a description for this file"
                />
              </div>

              <div className="space-y-2">
                <Label>Options</Label>
                <div className="flex flex-wrap gap-2">
                  {fileMetadata.category &&
                    categories
                      .find((c) => c.name === fileMetadata.category)
                      ?.options.map((option) => (
                        <Badge
                          key={option}
                          variant={fileMetadata.options?.includes(option) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            const currentOptions = fileMetadata.options || []
                            const newOptions = currentOptions.includes(option)
                              ? currentOptions.filter((o) => o !== option)
                              : [...currentOptions, option]
                            setFileMetadata({ ...fileMetadata, options: newOptions })
                          }}
                        >
                          {option}
                        </Badge>
                      ))}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveFileMetadata}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            Select a file to edit its metadata
          </div>
        )}
      </TabsContent>

      <TabsContent value="categories" className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Document Categories</h3>
          <Button onClick={handleAddCategory} size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-4">
          {categories.map((category) => (
            <Card key={category.id}>
              <CardHeader className="pb-2">
                {editingCategory?.id === category.id ? (
                  <Input
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                    className="font-semibold text-lg"
                    autoFocus
                  />
                ) : (
                  <CardTitle className="flex justify-between items-center">
                    {category.name}
                    <Button variant="ghost" size="sm" onClick={() => handleEditCategory(category)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                )}

                {editingCategory?.id === category.id ? (
                  <Textarea
                    value={editingCategory.description}
                    onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                    className="text-sm text-muted-foreground mt-2"
                    rows={2}
                  />
                ) : (
                  <CardDescription>{category.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(editingCategory?.id === category.id ? editingCategory.options : category.options).map((option) => (
                    <Badge
                      key={option}
                      className="flex items-center gap-1"
                      variant={editingCategory?.id === category.id ? "default" : "outline"}
                    >
                      {editingCategory?.id === category.id ? (
                        <>
                          {option}
                          <button
                            onClick={() => handleRemoveOption(category.id, option)}
                            className="text-xs hover:text-foreground ml-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        option
                      )}
                    </Badge>
                  ))}
                </div>

                {editingCategory?.id === category.id && (
                  <div className="flex gap-2 mt-3">
                    <Input
                      placeholder="New option"
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddOption(category.id)
                        }
                      }}
                    />
                    <Button onClick={() => handleAddOption(category.id)} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                {editingCategory?.id === category.id ? (
                  <div className="flex gap-2 w-full justify-end">
                    <Button variant="outline" onClick={() => setEditingCategory(null)} size="sm">
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button onClick={handleSaveCategory} size="sm">
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => handleEditCategory(category)} size="sm">
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  )
}
