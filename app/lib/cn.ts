import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge class names with clsx + tailwind-merge (later utilities win). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
