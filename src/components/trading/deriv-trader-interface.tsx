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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { executeTradeAction } from "@/app/actions/trading-actions";
import { useToast } from "@/hooks/use-toast";

const digitalOptionsTypes = [
  "Rise/Fall",
  "Higher/Lower",
  "EndBetweens",
  "StaysBetween",
  "Lookbacks",
  "Touch/NoTouch",
  "OnlyUps/Downs",
  "Highest/Lowest",
  "ResetCall",
  "AsianUpDown",
  "Digit:Matches/Differs",
  "Digit:Even/Odd",
  "Digit:Over/Under",
];

const riseFallSchema = z.object({
  stake: z.coerce.number().min(0.35, "O valor mínimo é $0.35."),
  duration: z.string().min(1, "A duração é obrigatória."),
  allowEquals: z.boolean().default(false),
});

type RiseFallFormValues = z.infer<typeof riseFallSchema>;

interface DerivTraderInterfaceProps {
  symbol: string;
}

export function DerivTraderInterface({ symbol }: DerivTraderInterfaceProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<"rise" | "fall" | null>(null);

  const form = useForm<RiseFallFormValues>({
    resolver: zodResolver(riseFallSchema),
    defaultValues: {
      stake: 10,
      duration: "5 ticks",
      allowEquals: false,
    },
  });

  const handleTrade = async (
    tradeDirection: "rise" | "fall"
  ) => {
    const data = form.getValues();
    setLoading(tradeDirection);
    const result = await executeTradeAction({
      symbol: symbol,
      tradeDirection,
      quantity: data.stake,
      allowEquals: data.allowEquals,
    });
    setLoading(null);

    if (result.success) {
      toast({
        title: "Ordem Executada!",
        description: result.success,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Falha na Negociação",
        description:
          result.error || "Não foi possível executar a ordem. Tente novamente.",
      });
    }
  };

  return (
      <Card>
        <Tabs defaultValue="options">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="multipliers" disabled>
              Multiplicadores
            </TabsTrigger>
            <TabsTrigger value="options">Opções</TabsTrigger>
          </TabsList>

          {/* Multipliers Tab (Disabled for now) */}
          <TabsContent value="multipliers">
            {/* Content can be added here later */}
          </TabsContent>

          {/* Options Tab */}
          <TabsContent value="options">
            <CardHeader>
              <CardTitle className="font-headline">Opções Digitais</CardTitle>
              <CardDescription>
                Preveja o resultado e ganhe um pagamento fixo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Form {...form}>
                <form className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de Opção</Label>
                    <Select defaultValue="Rise/Fall" disabled>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {digitalOptionsTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duração</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={!!loading} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="stake"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stake (USD)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              disabled={!!loading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="allowEquals"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Permitir Empates</FormLabel>
                          <p className="text-[0.8rem] text-muted-foreground">
                            Ganha se o preço de saída for igual ao de entrada.
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={!!loading}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2 pt-2">
                    <p className="text-sm text-center text-muted-foreground">
                      Pagamento Potencial: $19.50 (simulado)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <Button
                      variant="outline"
                      className="h-12 bg-green-50/50 text-green-600 border-green-200 hover:bg-green-100 hover:text-green-700"
                      onClick={() => handleTrade("rise")}
                      disabled={!!loading}
                    >
                      {loading === "rise" ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <ArrowUp className="mr-2 h-5 w-5" /> Rise
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-12 bg-red-50/50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700"
                      onClick={() => handleTrade("fall")}
                      disabled={!!loading}
                    >
                      {loading === "fall" ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <ArrowDown className="mr-2 h-5 w-5" /> Fall
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
  );
}
