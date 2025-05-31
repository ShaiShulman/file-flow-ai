"use client";

import { apiClient } from "@/features/api/client";
import type { Category } from "@/lib/types";

export interface ServerCategory {
  [key: string]: string[];
}

export interface CategoryApiResponse {
  status: string;
  message: string;
}

// Convert frontend Category type to server format
function categoryToServerFormat(category: Category): {
  name: string;
  values: string[];
} {
  return {
    name: category.name,
    values: category.options,
  };
}

// Convert server format to frontend Category type
function serverToCategory(name: string, values: string[]): Category {
  return {
    id: name, // Use name as ID for server categories
    name,
    options: values,
  };
}

export async function syncCategoriesWithServer(
  categories: Category[]
): Promise<void> {
  try {
    // Convert categories to server format
    const serverCategories: Record<string, string[]> = {};
    categories.forEach((category) => {
      serverCategories[category.name] = category.options;
    });

    // Use the new reset endpoint for more efficient sync
    await apiClient.resetCategories(serverCategories);
  } catch (error) {
    console.error("Failed to sync categories with server:", error);
    throw new Error("Failed to sync categories with server");
  }
}

export async function resetCategoriesOnServer(
  categories: Category[]
): Promise<void> {
  try {
    // Convert categories to server format
    const serverCategories: Record<string, string[]> = {};
    categories.forEach((category) => {
      serverCategories[category.name] = category.options;
    });

    await apiClient.resetCategories(serverCategories);
  } catch (error) {
    console.error("Failed to reset categories on server:", error);
    throw new Error("Failed to reset categories on server");
  }
}

export async function getCategoriesFromServer(): Promise<Category[]> {
  try {
    const serverCategories = await apiClient.getCategories();

    return Object.entries(serverCategories).map(([name, values]) =>
      serverToCategory(name, values)
    );
  } catch (error) {
    console.error("Failed to get categories from server:", error);
    throw new Error("Failed to get categories from server");
  }
}

export async function addCategoryToServer(category: Category): Promise<void> {
  try {
    const { name, values } = categoryToServerFormat(category);
    await apiClient.addOrUpdateCategory(name, values);
  } catch (error) {
    console.error("Failed to add category to server:", error);
    throw new Error("Failed to add category to server");
  }
}

export async function updateCategoryOnServer(
  category: Category
): Promise<void> {
  try {
    const { name, values } = categoryToServerFormat(category);
    await apiClient.addOrUpdateCategory(name, values);
  } catch (error) {
    console.error("Failed to update category on server:", error);
    throw new Error("Failed to update category on server");
  }
}

export async function deleteCategoryFromServer(
  categoryName: string
): Promise<void> {
  try {
    await apiClient.deleteCategory(categoryName);
  } catch (error) {
    console.error("Failed to delete category from server:", error);
    throw new Error("Failed to delete category from server");
  }
}

export async function clearAllCategoriesOnServer(): Promise<void> {
  try {
    await apiClient.clearAllCategories();
  } catch (error) {
    console.error("Failed to clear categories on server:", error);
    throw new Error("Failed to clear categories on server");
  }
}
