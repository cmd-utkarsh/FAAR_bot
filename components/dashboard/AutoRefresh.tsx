"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AutoRefreshProps {
  intervalMs: number;
  children: React.ReactNode;
}

export function AutoRefresh({ intervalMs, children }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, router]);

  return <>{children}</>;
}
