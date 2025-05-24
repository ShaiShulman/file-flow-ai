"use server";

import { revalidatePath } from "next/cache";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { Category } from "@/lib/types";

const CATEGORIES_FILE = path.join(process.cwd(), "data", "categories.json");

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
    categories[index] = { ...categories[index], ...updatedCategory };
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
