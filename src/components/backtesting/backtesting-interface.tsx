"use client";

import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { runStrategyBacktest } from "@/app/actions/trading-actions";

const formSchema = z.object({
  strategyDescription: z.string().min(10, "A descrição da estratégia é muito curta."),
});

type FormValues = z.infer<typeof formSchema>;

export function BacktestingInterface() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { strategyDescription: "" },
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    setLoading(true);
    setResult(null);

    const response = await runStrategyBacktest(data);

    if (response.success) {
      setResult(response.success);
    } else {
      setResult(`Erro: ${response.error}`);
    }

    setLoading(false);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="font-headline">Simulador de Estratégia</CardTitle>
          <CardDescription>
            Descreva uma estratégia de investimento em linguagem natural e a IA irá simular seu desempenho.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col flex-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex flex-col flex-1">
              <FormField
                control={form.control}
                name="strategyDescription"
                render={({ field }) => (
                  <FormItem className="flex-1 flex flex-col">
                    <FormLabel>Descrição da Estratégia</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ex: Comprar PETR4 se a média móvel de 10 dias cruzar acima da de 30 dias e vender o oposto. Começar com R$10.000, período de 1 ano."
                        className="flex-1 resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="mr-2 h-4 w-4" />
                )}
                Rodar Simulação
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="font-headline">Resultados da Simulação</CardTitle>
           <CardDescription>
            A IA analisará sua estratégia e retornará um resumo do resultado.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {result && (
            <Alert className="bg-primary/5 border-primary/20 h-full">
                <TestTube className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary font-headline">Análise da IA</AlertTitle>
                <AlertDescription className="text-primary/90 whitespace-pre-wrap">
                    {result}
                </AlertDescription>
            </Alert>
          )}
           {!loading && !result && (
             <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                <p>Os resultados da sua simulação aparecerão aqui.</p>
            </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
