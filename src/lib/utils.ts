import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea texto para mostrar en pantalla: primera letra de cada palabra en mayúscula, resto en minúscula.
 * Los datos se guardan en minúsculas en BD; esta función normaliza la visualización.
 */
export function formatDisplayText(str: string | null | undefined): string {
  if (str == null || typeof str !== "string") return str ?? "";
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}
