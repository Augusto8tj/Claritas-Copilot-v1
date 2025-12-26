
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
import { Copy, Sparkles, Wand } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '../ui/label';

interface ManualCouncilInterfaceProps {
  prompt: string;
  onProcessResponse: (response: string) => void;
}

export function ManualCouncilInterface({ prompt, onProcessResponse }: ManualCouncilInterfaceProps) {
  const [response, setResponse] = useState('');
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    toast({
      title: 'Copiado!',
      description: 'O prompt foi copiado para a sua área de transferência.',
    });
  };

  const handleSubmit = () => {
    if (!response.trim()) {
      toast({
        variant: 'destructive',
        title: 'Resposta Vazia',
        description: 'Por favor, cole a resposta da IA antes de processar.',
      });
      return;
    }
    onProcessResponse(response);
  };

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2 text-primary">
          <Wand className="h-5 w-5" />
          Interface Manual da Mesa Operacional
        </CardTitle>
        <CardDescription className="text-primary/90">
          Utilize uma IA externa para formar o conselho. Copie o prompt, obtenha a resposta e cole-a abaixo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="manual-prompt">1. Prompt para a IA Externa</Label>
          <div className="relative mt-2">
            <Textarea
              id="manual-prompt"
              readOnly
              value={prompt}
              className="h-48 resize-none font-mono text-xs bg-background/50"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCopy}
              className="absolute top-2 right-2 h-7 w-7"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div>
            <Label htmlFor="manual-response">2. Cole a Resposta da IA Aqui</Label>
            <Textarea
                id="manual-response"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder='Cole o objeto JSON completo retornado pela sua IA aqui... (Ex: { "council": [ ... ] })'
                className="h-48 resize-none mt-2 font-mono text-xs"
            />
        </div>
        <Button onClick={handleSubmit} className="w-full">
            <Sparkles className="mr-2 h-4 w-4" />
            Processar Resposta e Montar Conselho
        </Button>
      </CardContent>
    </Card>
  );
}
