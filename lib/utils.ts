import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
export const chunk = <T,>(items: T[], size: number): T[][] => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
export async function retry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> { let lastError: unknown; for (let index = 0; index < attempts; index += 1) { try { return await operation(); } catch (error) { lastError = error; await sleep(2 ** index * 250); } } throw lastError instanceof Error ? lastError : new Error("Operation failed"); }
