
'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Sparkles, Wand, CheckCircle, Clock, ClipboardPaste } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '../ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { ManualPromptBatch } from '@/hooks/use-robot-council';

interface ManualCouncilInterfaceProps {
  batches: ManualPromptBatch[];
  onProcessResponse: (batchId: string, response: string) => void;
}

// THIS COMPONENT IS NO LONGER USED AS THE COUNCIL IS BUILT LOCALLY.
// It is kept for historical purposes but can be removed in a future cleanup.
export function ManualCouncilInterface({ batches, onProcessResponse }: ManualCouncilInterfaceProps) {
  const [responses, setResponses] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: 'O prompt foi copiado para a sua área de transferência.',
    });
  };

  const handlePaste = async (batchId: string) => {
    try {
        const text = await navigator.clipboard.readText();
        setResponses(prev => ({...prev, [batchId]: text}));
        toast({
            title: 'Colado!',
            description: 'O conteúdo da área de transferência foi colado.',
        });
    } catch (error) {
        console.error('Falha ao ler da área de transferência:', error);
        toast({
            variant: 'destructive',
            title: 'Falha ao Colar',
            description: 'Não foi possível ler o conteúdo da área de transferência. Verifique as permissões do seu navegador.',
        });
    }
  };

  const handleSubmit = (batchId: string) => {
    const response = responses[batchId];
    if (!response || !response.trim()) {
      toast({
        variant: 'destructive',
        title: 'Resposta Vazia',
        description: 'Por favor, cole a resposta da IA antes de processar.',
      });
      return;
    }
    onProcessResponse(batchId, response);
  };
  
  // Determine qual o primeiro lote não concluído para abrir por defeito
  const firstIncompleteBatchId = batches.find(b => !b.isCompleted)?.id;

  if (batches.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2 text-primary">
          <Wand className="h-5 w-5" />
          Linha de Montagem Manual (Descontinuado)
        </CardTitle>
        <CardDescription className="text-primary/90">
          Este componente era usado para construir o conselho manualmente via IA. Agora o processo é automático e local.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Accordion type="single" collapsible defaultValue={firstIncompleteBatchId} className="w-full">
            {batches.map((batch, index) => (
                <AccordionItem value={batch.id} key={batch.id} disabled={index > 0 && !batches[index - 1].isCompleted}>
                    <AccordionTrigger>
                        <div className="flex items-center gap-2">
                             {batch.isCompleted ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                             ) : (
                                <Clock className="h-5 w-5 text-yellow-500" />
                             )}
                             <span className={batch.isCompleted ? "text-muted-foreground line-through" : ""}>Passo {index + 1}: {batch.theme}</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                         <div>
                            <Label htmlFor={`manual-prompt-${batch.id}`}>1. Copie o Prompt para a IA</Label>
                            <div className="relative mt-2">
                                <Textarea
                                id={`manual-prompt-${batch.id}`}
                                readOnly
                                value={batch.prompt}
                                className="h-40 resize-none font-mono text-xs bg-background/50"
                                />
                                <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleCopy(batch.prompt)}
                                className="absolute top-2 right-2 h-7 w-7"
                                >
                                <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center">
                                <Label htmlFor={`manual-response-${batch.id}`}>2. Cole a Resposta JSON Aqui</Label>
                                <Button variant="outline" size="sm" className="h-7" onClick={() => handlePaste(batch.id)}>
                                    <ClipboardPaste className="mr-2 h-3 w-3" />
                                    Colar
                                </Button>
                            </div>
                            <Textarea
                                id={`manual-response-${batch.id}`}
                                value={responses[batch.id] || ''}
                                onChange={(e) => setResponses(prev => ({...prev, [batch.id]: e.target.value}))}
                                placeholder='Cole o objeto JSON completo retornado pela sua IA aqui... (Ex: { "robots": [ ... ] })'
                                className="h-32 resize-none mt-2 font-mono text-xs"
                            />
                        </div>
                        <Button onClick={() => handleSubmit(batch.id)} className="w-full">
                            <Sparkles className="mr-2 h-4 w-4" />
                            Processar Lote {index + 1} e Adicionar Analistas
                        </Button>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
