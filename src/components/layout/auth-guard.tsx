"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, type ReactNode } from "react";

const publicPaths = ["/login", "/signup"];

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) {
      return; // Don't do anything while loading
    }

    const isPublic = publicPaths.includes(pathname);

    // If the user is not logged in and not on a public page, redirect to login
    if (!user && !isPublic) {
      router.replace("/login");
    }

    // If the user is logged in and on a public page, redirect to home
    if (user && isPublic) {
      router.replace("/");
    }
  }, [user, loading, router, pathname]);


  if (loading) {
    return null; // O provedor de autenticação já mostra um loader
  }
  
  const isPublic = publicPaths.includes(pathname);

  // Render children only if the conditions are met to avoid flickering
  if ((user && !isPublic) || (!user && isPublic)) {
     return <>{children}</>;
  }

  return null;
}
