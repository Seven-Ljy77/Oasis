// =============================================================================
// Mercury — Generic debounce hook
//
// Returns a debounced version of the input value that only updates after
// the specified delay has elapsed without further changes.
// =============================================================================

import { useEffect, useState } from "react";

/**
 * Debounce a rapidly-changing value.
 *
 * @param value  The source value
 * @param delay  Debounce delay in milliseconds
 * @returns      The debounced value
 *
 * @example
 * const debouncedSearch = useDebounce(searchText, 300);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
