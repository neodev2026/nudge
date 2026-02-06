/**
 * Utility Functions Module
 *
 * This module provides utility functions used throughout the application.
 * It includes helpers for class name management and other common operations.
 *
 * The primary utility here is the `cn` function which combines the power of
 * clsx (for conditional class names) and tailwind-merge (for resolving
 * Tailwind CSS class conflicts).
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple class values into a single className string
 * 
 * This utility function combines the power of clsx and tailwind-merge to:
 * 1. Process conditional class names, arrays, objects, etc. with clsx
 * 2. Properly merge Tailwind CSS classes and handle conflicts with tailwind-merge
 * 
 * Use this function whenever you need to combine multiple classes, especially
 * when working with conditional classes or component variants.
 * 
 * @example
 * // Basic usage
 * cn('text-red-500', 'bg-blue-500')
 * 
 * // With conditionals
 * cn('text-base', isLarge && 'text-lg')
 * 
 * // With object syntax
 * cn({ 'text-red-500': isError, 'text-green-500': isSuccess })
 * 
 * // Resolving conflicts (last one wins)
 * cn('text-red-500', 'text-blue-500') // -> 'text-blue-500'
 * 
 * @param inputs - Any number of class values (strings, objects, arrays, etc.)
 * @returns A merged className string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


/**
 * SM-2 알고리즘 기반 다음 학습 상태 계산
 */
export interface SRSState {
  iteration: number;
  interval: number;
  easiness: number;
}

export function calculateNextReview(
  quality: number, // 0~5점
  current: SRSState = { iteration: 0, interval: 0, easiness: 2.5 }
): SRSState {
  let { iteration, interval, easiness } = current;

  // 1. 품질이 3점 미만이면 반복 횟수 리셋
  if (quality < 3) {
    iteration = 0;
    interval = 1;
  } else {
    // 2. 새로운 Easiness Factor 계산
    easiness = easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easiness < 1.3) easiness = 1.3;

    // 3. 복습 간격(Interval) 결정
    if (iteration === 0) {
      interval = 1;
    } else if (iteration === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easiness);
    }
    iteration += 1;
  }

  return { iteration, interval, easiness };
}