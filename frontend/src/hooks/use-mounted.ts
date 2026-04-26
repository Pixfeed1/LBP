"use client";
import { useEffect, useState } from "react";

/**
 * Hook qui retourne true uniquement apres le mount client.
 * Utile pour eviter les hydration mismatches Next.js quand on
 * affiche des contenus qui dependent du browser (Date.now, toLocaleString...).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
