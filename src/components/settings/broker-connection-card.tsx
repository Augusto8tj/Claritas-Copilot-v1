
"use client";

import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "../ui/button";
import { Loader2, Link, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  apiToken: z.string().min(10, "O token da API parece muito curto."),
});

type FormValues = z.infer<typeof formSchema>;

export function BrokerConnectionCard() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { apiToken: "" },
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    setIsConnecting(true);
    // Simula uma chamada de API para verificar o token
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Em um app real, você faria uma chamada para a API da corretora
    // para validar o token. Aqui vamos simular sucesso ou falha.
    const isTokenValid = !data.apiToken.includes("invalido");

    setIsConnecting(false);

    if (isTokenValid) {
        setIsConnected(true);
        toast({
            title: "Conexão Estabelecida",
            description: "Sua conta da corretora foi conectada com sucesso.",
        });
    } else {
        setIsConnected(false);
        toast({
            variant: "destructive",
            title: "Falha na Conexão",
            description: "O token da API é inválido. Verifique e tente novamente.",
        });
    }
  };
  
  const handleDisconnect = () => {
    setIsConnected(false);
    form.reset({ apiToken: "" });
     toast({
        title: "Desconectado",
        description: "A conexão com a corretora foi removida.",
      });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Conexão com a Corretora</CardTitle>
        <CardDescription>
          Conecte sua conta da corretora (ex: Deriv) para habilitar funcionalidades de trading com IA.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="flex items-center justify-between rounded-lg border border-green-500/50 bg-green-500/10 p-4">
            <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                    <h3 className="font-semibold text-green-700">Conta Conectada</h3>
                    <p className="text-sm text-green-700/80">O Claritas Copilot agora pode interagir com sua corretora.</p>
                </div>
            </div>
            <Button variant="destructive" onClick={handleDisconnect}>
                <XCircle className="mr-2 h-4 w-4" />
                Desconectar
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="apiToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token da API</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Cole seu token de API aqui"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isConnecting}>
                {isConnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Link className="mr-2 h-4 w-4" />
                )}
                Conectar
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
