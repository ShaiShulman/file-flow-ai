"use server";

import { revalidatePath } from "next/cache";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { Category } from "@/lib/types";

const CATEGORIES_FILE = process.env.CATEGORIES_FILE
  ? path.join(process.cwd(), process.env.CATEGORIES_FILE)
  : path.join(process.cwd(), "data", "categories.json");

// Server-side API sync functions
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

async function syncCategoriesWithServerSide(
  categories: Category[]
): Promise<void> {
  try {
    // Convert categories to server format
    const serverCategories: Record<string, string[]> = {};
    categories.forEach((category) => {
      serverCategories[category.name] = category.options;
    });

    const response = await fetch(`${API_BASE_URL}/categories/reset`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(serverCategories),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to sync categories with server:", error);
    // Don't throw - continue with local update even if server sync fails
  }
}

// Ensure the data directory exists
async function ensureDataDir() {
  const dataDir = path.join(process.cwd(), "data");
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

interface CategoriesData {
  categories: Category[];
}

// Get all categories
export async function getCategories(): Promise<Category[]> {
  try {
    const data = await fs.readFile(CATEGORIES_FILE, "utf-8");
    const { categories } = JSON.parse(data) as CategoriesData;
    return categories;
  } catch (error) {
    console.error("Error reading categories:", error);
    throw new Error("Failed to read categories");
  }
}

// Update categories
export async function updateCategories(categories: Category[]): Promise<void> {
  try {
    await ensureDataDir();
    const data: CategoriesData = { categories };
    await fs.writeFile(CATEGORIES_FILE, JSON.stringify(data, null, 2));

    // Sync with server on server side
    await syncCategoriesWithServerSide(categories);

    revalidatePath("/");
  } catch (error) {
    console.error("Error updating categories:", error);
    throw new Error("Failed to update categories");
  }
}

// Add a new category
export async function addCategory(category: Category): Promise<void> {
  const categories = await getCategories();
  categories.push(category);
  await updateCategories(categories);
}

// Update a category
export async function updateCategory(
  categoryId: string,
  updatedCategory: Partial<Category>
): Promise<void> {
  const categories = await getCategories();
  const index = categories.findIndex((cat) => cat.id === categoryId);
  if (index !== -1) {
    const updated = { ...categories[index], ...updatedCategory };
    categories[index] = updated;
    await updateCategories(categories);
  }
}

// Delete a category
export async function deleteCategory(categoryId: string): Promise<void> {
  const categories = await getCategories();
  const filteredCategories = categories.filter((cat) => cat.id !== categoryId);
  await updateCategories(filteredCategories);
}

// Add an option to a category
export async function addCategoryOption(
  categoryId: string,
  option: string
): Promise<void> {
  const categories = await getCategories();
  const index = categories.findIndex((cat) => cat.id === categoryId);
  if (index !== -1) {
    categories[index].options.push(option);
    await updateCategories(categories);
  }
}

// Delete an option from a category
export async function deleteCategoryOption(
  categoryId: string,
  option: string
): Promise<void> {
  const categories = await getCategories();
  const index = categories.findIndex((cat) => cat.id === categoryId);
  if (index !== -1) {
    categories[index].options = categories[index].options.filter(
      (opt) => opt !== option
    );
    await updateCategories(categories);
  }
}
