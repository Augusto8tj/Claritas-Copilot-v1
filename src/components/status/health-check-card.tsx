
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertTriangle, Loader2, Settings } from "lucide-react";
import Link from "next/link";
import { useDerivApi, type AccountType } from "@/hooks/use-deriv-api";

type CheckResult = {
  success: boolean;
  error?: string;
};

interface HealthCheckCardProps {
  serviceName: string;
  description: string;
  successMessage: string;
  failureMessage: string;
  configurePath: string;
  checkResult?: CheckResult; // For server-side checks
  isClientSide?: boolean; // Flag for client-side checks
  clientCheckAction?: (token: string, accountType: AccountType) => Promise<CheckResult>; // Action for client-side checks
}

export function HealthCheckCard({
  serviceName,
  description,
  successMessage,
  failureMessage,
  configurePath,
  checkResult,
  isClientSide = false,
  clientCheckAction
}: HealthCheckCardProps) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(failureMessage);
  
  const { demoToken, realToken, accountType } = useDerivApi();
  const activeToken = accountType === 'demo' ? demoToken : realToken;

  useEffect(() => {
    const runCheck = async () => {
      setStatus("loading");
      if (isClientSide) {
        if (!activeToken) {
          setErrorMessage("Nenhum token (demo ou real) configurado no navegador.");
          setStatus("error");
          return;
        }
        if (clientCheckAction) {
          const result = await clientCheckAction(activeToken, accountType);
          if (result.success) {
            setStatus("success");
          } else {
            setErrorMessage(result.error || failureMessage);
            setStatus("error");
          }
        }
      } else {
        // Server-side check result is passed as prop
        if (checkResult?.success) {
          setStatus("success");
        } else {
          setErrorMessage(checkResult?.error || failureMessage);
          setStatus("error");
        }
      }
    };

    runCheck();
  }, [checkResult, isClientSide, clientCheckAction, activeToken, accountType, failureMessage]);


  const StatusInfo = () => {
    switch (status) {
      case "loading":
        return (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="font-semibold">Verificando...</p>
          </div>
        );
      case "success":
        return (
          <div className="flex items-center gap-3 text-green-600">
            <CheckCircle className="h-6 w-6" />
            <div>
                <p className="font-semibold">Conectado</p>
                <p className="text-xs text-green-600/80">{successMessage}</p>
            </div>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-3 text-destructive">
            <XCircle className="h-6 w-6" />
             <div>
                <p className="font-semibold">Falha na Conexão</p>
                <p className="text-xs text-destructive/80">{errorMessage}</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">{serviceName}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border bg-card p-4">
          <StatusInfo />
        </div>
      </CardContent>
      {status === 'error' && (
        <CardFooter>
          <Button asChild variant="outline">
            <Link href={configurePath}>
              <Settings className="mr-2 h-4 w-4" />
              Ir para Configurações
            </Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
