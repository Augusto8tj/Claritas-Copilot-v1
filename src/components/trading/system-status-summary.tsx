
'use client';

import { BrainCircuit, Link as LinkIcon, Loader2, Server, Settings, ShieldCheck, ShieldX } from "lucide-react";
import { useDerivApi } from "@/hooks/use-deriv-api";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import Link from "next/link";
import React from "react";

export function SystemStatusSummary() {
    const { isConnected, isConnecting, connectionError } = useDerivApi();
    const [isGeminiOk, setIsGeminiOk] = React.useState(true); // Assume OK unless check fails

    // This is a simple client-side check. A full check is on the Status page.
    React.useEffect(() => {
        if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
            setIsGeminiOk(false);
        }
    }, []);

    const StatusIndicator = ({ status, label }: { status: 'ok' | 'loading' | 'error', label: string }) => (
        <div className="flex items-center gap-2">
            {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {status === 'ok' && <ShieldCheck className="h-4 w-4 text-green-600" />}
            {status === 'error' && <ShieldX className="h-4 w-4 text-destructive" />}
            <span className={cn(
                "text-sm font-medium",
                status === 'ok' && "text-green-700",
                status === 'error' && "text-destructive",
                status === 'loading' && "text-muted-foreground",
            )}>{label}</span>
        </div>
    );
    
    const getDerivStatus = (): 'ok' | 'loading' | 'error' => {
        if (isConnecting) return 'loading';
        if (isConnected) return 'ok';
        return 'error';
    }
    
    const getGeminiStatus = (): 'ok' | 'error' => {
        return isGeminiOk ? 'ok' : 'error';
    }
    
    const hasError = getDerivStatus() === 'error' || getGeminiStatus() === 'error';

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-3">
            <div className="flex items-center gap-4">
                <StatusIndicator status={getDerivStatus()} label="Conexão com a Corretora" />
                <StatusIndicator status={getGeminiStatus()} label="Conexão com IA" />
            </div>
            {hasError && (
                 <Button asChild variant="secondary" size="sm">
                    <Link href="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Verificar Configurações
                    </Link>
                </Button>
            )}
        </div>
    );
}
