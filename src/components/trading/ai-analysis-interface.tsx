
"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "../ui/button";
import { Loader2, Sparkles, BrainCircuit } from "lucide-react";
import { useDerivApi } from "@/hooks/use-deriv-api";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

export function AIAnalysisInterface() {
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { getAnalysis, operationsLog } = useDerivApi();

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    const result = await getAnalysis();
    setAnalysisResult(result);
    setIsAnalyzing(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-primary" />
            Análise com IA
        </CardTitle>
        <CardDescription>
          Peça à IA para analisar seu desempenho de negociação na sessão atual.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={handleAnalyze}
          disabled={isAnalyzing || operationsLog.length === 0}
        >
          {isAnalyzing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Analisar Desempenho
        </Button>
        {isAnalyzing && (
            <div className="flex items-center justify-center text-muted-foreground p-4">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Analisando...</span>
            </div>
        )}
        {analysisResult && (
          <Alert
            variant={
              analysisResult?.startsWith("Erro") ? "destructive" : "default"
            }
            className={
              analysisResult?.startsWith("Erro")
                ? ""
                : "bg-primary/5 border-primary/20"
            }
          >
            <AlertTitle
              className={
                analysisResult?.startsWith("Erro") ? "" : "text-primary"
              }
            >
              {analysisResult?.startsWith("Erro")
                ? "Erro na Análise"
                : "Resumo do Copiloto"}
            </AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">
              {analysisResult}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
