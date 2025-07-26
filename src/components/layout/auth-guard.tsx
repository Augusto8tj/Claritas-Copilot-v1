"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import type { ReactNode } from "react";

const publicPaths = ["/login", "/signup"];

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (loading) {
    return null; // O provedor de autenticação já mostra um loader
  }

  const isPublic = publicPaths.includes(pathname);

  if (!user && !isPublic) {
    router.replace("/login");
    return null;
  }

  if (user && isPublic) {
    router.replace("/");
    return null;
  }

  return <>{children}</>;
}
