
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Operation } from "./operations-log.types";
import { ArrowDown, ArrowUp, Loader2, Sparkles, BrainCircuit } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { useDerivApi } from "@/hooks/use-deriv-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";


interface OperationsLogProps {
  operations: Operation[];
}

export function OperationsLog({ operations }: OperationsLogProps) {
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { getAnalysis } = useDerivApi();

  const dailySummary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return operations
      .filter(op => op.status !== 'pending' && new Date(op.timestamp) >= today)
      .reduce((sum, op) => sum + (op.result || 0), 0);
  }, [operations]);
  
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const result = await getAnalysis();
    setAnalysisResult(result);
    setIsModalOpen(true);
    setIsAnalyzing(false);
  }


  return (
    <>
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="font-headline">Operações</CardTitle>
                <CardDescription>
                Histórico e status das suas negociações.
                </CardDescription>
            </div>
             <div className="text-right">
                <p className="text-xs text-muted-foreground">Resultado do Dia</p>
                <p className={cn(
                    "text-lg font-bold",
                    dailySummary > 0 && "text-green-600",
                    dailySummary < 0 && "text-destructive"
                )}>
                    {dailySummary.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })}
                </p>
            </div>
        </div>
        <div className="mt-4">
            <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={isAnalyzing || operations.length === 0}>
                {isAnalyzing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                )}
                Analisar Performance com IA
            </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[280px] sm:h-[320px] lg:h-[calc(100%-1rem)]">
          <div className="p-6 pt-0 space-y-4">
            {operations.length === 0 ? (
              <div className="text-center text-muted-foreground pt-10">
                <p>Nenhuma operação recente.</p>
              </div>
            ) : (
              operations.map((op) => (
                <div key={op.id} className="flex items-center">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {op.asset} - {op.direction === "rise" ? "Rise" : "Fall"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Entrada: ${op.stake.toFixed(2)}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-sm font-semibold",
                      op.status === "pending" && "text-muted-foreground",
                      op.status === "won" && "text-green-600",
                      op.status === "lost" && "text-destructive"
                    )}
                  >
                    {op.status === "pending" ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Em Andamento</span>
                      </>
                    ) : op.status === "won" ? (
                      <>
                        <ArrowUp className="h-4 w-4" />
                        <span>+${op.result?.toFixed(2)}</span>
                      </>
                    ) : (
                      <>
                        <ArrowDown className="h-4 w-4" />
                        <span>-${op.stake.toFixed(2)}</span>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>

    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="font-headline flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-primary" />
                    Análise de Performance da IA
                </DialogTitle>
                <DialogDescription>
                    Um resumo estatístico do seu desempenho de negociação na sessão atual.
                </DialogDescription>
            </DialogHeader>
            <Alert variant={analysisResult?.startsWith("Erro") ? "destructive" : "default"} className={analysisResult?.startsWith("Erro") ? "" : "bg-primary/5 border-primary/20"}>
                 <AlertTitle className={analysisResult?.startsWith("Erro") ? "" : "text-primary"}>
                    {analysisResult?.startsWith("Erro") ? "Erro na Análise" : "Resumo do Copiloto"}
                 </AlertTitle>
                <AlertDescription className="whitespace-pre-wrap">
                    {analysisResult || "Nenhum resultado para exibir."}
                </AlertDescription>
            </Alert>
        </DialogContent>
    </Dialog>
    </>
  );
}
