"use client";

import { BrainCircuit, Loader2, AlertTriangle } from 'lucide-react';
import React, { useState } from 'react';

import { checkGeminiConnection } from '@/app/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export function ListModelsCard() {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    const handleListModels = async () => {
        setIsLoading(true);
        setResult(null);
        try {
            const response = await checkGeminiConnection();
            if (response.success && response.models) {
                const modelList = response.models.map((model: any) => `- ${model.displayName || model.name} (Suporta: ${model.supportedGenerationMethods.join(', ')})`).join('\n') || 'Nenhum modelo encontrado.';
                setResult(`Conexão bem-sucedida!\n\nModelos disponíveis encontrados:\n\n${modelList}`);
            } else {
                throw new Error(response.error || "A verificação da IA retornou uma falha desconhecida.");
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
            setResult(`ERRO: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><BrainCircuit className="h-5 w-5" />Diagnóstico de Modelos de IA</CardTitle>
                <CardDescription>Verifique quais modelos de IA estão realmente disponíveis para a sua chave de API.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Alert variant="default">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Como Usar</AlertTitle>
                    <AlertDescription>
                        Se a IA apresentar erros de &quot;API key not valid&quot; ou &quot;model not found&quot;, clique no botão abaixo. Isso testa a conexão e lista os modelos que sua chave de API pode acessar.
                    </AlertDescription>
                </Alert>
                <Button onClick={handleListModels} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    {isLoading ? "Verificando..." : "Verificar Modelos de IA"}
                </Button>

                {result && (
                    <div className="space-y-1.5">
                        <Label>Resultado da Verificação:</Label>
                        <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap max-h-60">{result}</pre>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
