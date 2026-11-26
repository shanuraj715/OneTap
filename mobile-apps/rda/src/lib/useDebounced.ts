import { useEffect, useState } from "react";

/** `value`, but only once it has stopped changing for `ms` — so typing "9876" asks the server once, not four times. */
export function useDebounced<T>(value: T, ms = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}
