
"use client";

import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Info, Loader2, Minus, Plus } from "lucide-react";
import { executeTradeAction } from "@/app/actions/trading-actions";
import { useToast } from "@/hooks/use-toast";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDerivApi } from "@/hooks/use-deriv-api";

type DurationUnit = 'ticks' | 'seconds' | 'minutes' | 'hours' | 'days';
type TradeType = 'Rise/Fall' | 'Higher/Lower' | 'Touch/No Touch';

const riseFallSchema = z.object({
  stake: z.coerce.number().min(0.35, "O valor mínimo é $0.35."),
  duration: z.coerce.number().min(1, "A duração deve ser de pelo menos 1."),
  duration_unit: z.nativeEnum({
    ticks: 'ticks',
    seconds: 'seconds',
    minutes: 'minutes',
    hours: 'hours',
    days: 'days',
  }),
  allowEquals: z.boolean().default(false),
});

type RiseFallFormValues = z.infer<typeof riseFallSchema>;

interface DerivTraderInterfaceProps {
  symbol: string;
}

const durationUnitLabels: Record<DurationUnit, string> = {
  ticks: "Ticks",
  seconds: "Segundos",
  minutes: "Minutos",
  hours: "Horas",
  days: "Dias",
};

const durationLimits: Record<DurationUnit, { min: number, max: number }> = {
    ticks: { min: 5, max: 10 },
    seconds: { min: 15, max: 60 },
    minutes: { min: 1, max: 60 },
    hours: { min: 1, max: 24 },
    days: { min: 1, max: 365 },
}

const tradeTypes: {label: TradeType, description: string}[] = [
    { label: "Rise/Fall", description: "Preveja se o preço de saída será maior ou menor que o preço de entrada." },
    { label: "Higher/Lower", description: "Preveja se o preço terminará mais alto ou mais baixo que um alvo de preço." },
    { label: "Touch/No Touch", description: "Preveja se o mercado tocará ou não um alvo a qualquer momento durante o período do contrato." },
]

export function DerivTraderInterface({ symbol }: DerivTraderInterfaceProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<"rise" | "fall" | null>(null);
  const [tradeType, setTradeType] = useState<TradeType>('Rise/Fall');
  const { refreshBalance } = useDerivApi();

  const form = useForm<RiseFallFormValues>({
    resolver: zodResolver(riseFallSchema),
    defaultValues: {
      stake: 10,
      duration: 5,
      duration_unit: "ticks",
      allowEquals: false,
    },
  });

  const durationUnit = form.watch('duration_unit');

  const handleDurationChange = (amount: number) => {
    const currentDuration = form.getValues('duration');
    const { min, max } = durationLimits[durationUnit];
    let newDuration = currentDuration + amount;
    if (newDuration < min) newDuration = min;
    if (newDuration > max) newDuration = max;
    form.setValue('duration', newDuration);
    form.trigger('duration');
  };

  const handleTrade = async (tradeDirection: "rise" | "fall") => {
    // Manually trigger validation
    const isValid = await form.trigger();
    if (!isValid) {
        toast({
            variant: "destructive",
            title: "Entrada Inválida",
            description: "Por favor, corrija os erros no formulário antes de negociar.",
        });
        return;
    }

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
      // Refresh balance after a trade
      setTimeout(refreshBalance, 1000); // Small delay to allow API to update
    } else {
      toast({
        variant: "destructive",
        title: "Falha na Negociação",
        description: result.error || "Não foi possível executar a ordem. Tente novamente.",
      });
    }
  };

  const payout = (form.watch('stake') * 1.942).toFixed(2);
  const payoutPercentage = "94.20%";

  return (
    <Card className="bg-card/50">
      <CardContent className="p-4 space-y-4">
        <Popover>
            <PopoverTrigger asChild>
                <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer transition-colors">
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled><ChevronLeft className="h-5 w-5" /></Button>
                    <div className="flex items-center gap-2">
                        <ArrowUp className="text-green-500 h-5 w-5" />
                        <ArrowDown className="text-red-500 h-5 w-5" />
                        <span className="font-semibold text-sm">{tradeType}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled><ChevronRight className="h-5 w-5" /></Button>
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Tipos de Negociação</h4>
                        <p className="text-sm text-muted-foreground">
                        Escolha o tipo de contrato que deseja negociar.
                        </p>
                    </div>
                    <div className="grid gap-2">
                        {tradeTypes.map((type) => (
                             <Button
                                key={type.label}
                                variant={tradeType === type.label ? "secondary" : "ghost"}
                                onClick={() => setTradeType(type.label)}
                                className="justify-start h-auto p-2"
                                disabled={type.label !== 'Rise/Fall'} // Enable only Rise/Fall for now
                            >
                                <div className="flex flex-col items-start">
                                    <span className="font-semibold">{type.label}</span>
                                    <span className="text-xs text-muted-foreground text-left">{type.description}</span>
                                </div>
                            </Button>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>

        <Separator />

        <Form {...form}>
            <form className="space-y-4">
                <Tabs defaultValue="duration" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="duration">Duração</TabsTrigger>
                        <TabsTrigger value="endtime" disabled>Hora de término</TabsTrigger>
                    </TabsList>
                    <TabsContent value="duration" className="pt-2">
                        <div className="flex gap-2">
                            <FormField
                                control={form.control}
                                name="duration_unit"
                                render={({ field }) => (
                                    <FormItem className="w-1/2">
                                        <Select onValueChange={(value) => {
                                            const newUnit = value as DurationUnit;
                                            field.onChange(newUnit);
                                            form.setValue('duration', durationLimits[newUnit].min); // Reset duration to min of new unit
                                            form.trigger('duration');
                                        }} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Unidade" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {Object.entries(durationUnitLabels).map(([value, label]) => (
                                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="duration"
                                render={({ field }) => (
                                <FormItem className="w-1/2">
                                    <div className="flex items-center justify-center gap-0.5">
                                        <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => handleDurationChange(-1)}><Minus className="h-4 w-4"/></Button>
                                        <div className="relative flex-1">
                                            <FormControl>
                                                <Input 
                                                    type="number"
                                                    {...field}
                                                    onChange={e => field.onChange(parseInt(e.target.value))}
                                                    className="font-semibold text-lg text-center border-y border-x-0 rounded-none focus-visible:ring-0 h-10"
                                                />
                                            </FormControl>
                                        </div>
                                         <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => handleDurationChange(1)}><Plus className="h-4 w-4"/></Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                    </TabsContent>
                </Tabs>
                
                <Separator />
                
                <Tabs defaultValue="stake" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="stake">Entrada</TabsTrigger>
                        <TabsTrigger value="payout" disabled>Pagamento</TabsTrigger>
                    </TabsList>
                    <TabsContent value="stake" className="pt-2">
                        <FormField
                            control={form.control}
                            name="stake"
                            render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center justify-center gap-2">
                                    <Button type="button" variant="outline" size="icon" onClick={() => form.setValue('stake', Math.max(0.35, field.value - 1))}><Minus className="h-4 w-4"/></Button>
                                    <div className="relative flex-1">
                                        <FormControl>
                                            <Input type="number" {...field} className="text-center font-bold text-lg pr-12"/>
                                        </FormControl>
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">USD</span>
                                    </div>
                                    <Button type="button" variant="outline" size="icon" onClick={() => form.setValue('stake', field.value + 1)}><Plus className="h-4 w-4"/></Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </TabsContent>
                </Tabs>

                <FormField
                    control={form.control}
                    name="allowEquals"
                    render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0 pt-2">
                        <FormControl>
                            <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={!!loading}
                                id="allowEquals"
                            />
                        </FormControl>
                        <Label htmlFor="allowEquals" className="text-sm font-normal text-muted-foreground cursor-pointer">
                            Permitir "Equals"
                        </Label>
                        <Info className="h-3 w-3 text-muted-foreground" />
                    </FormItem>
                    )}
                />
            </form>
        </Form>
        
        <div className="space-y-2 pt-2">
             <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Pagamento</span>
                <span className="font-semibold text-foreground">{payout} USD</span>
             </div>
             <Button
                variant="outline"
                className="w-full h-14 bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20 hover:text-green-700 flex justify-between items-center"
                onClick={() => handleTrade("rise")}
                disabled={!!loading}
            >
                {loading === "rise" ? ( <Loader2 className="h-5 w-5 animate-spin" /> ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <ArrowUp className="h-5 w-5" />
                            <span className="font-semibold">Rise</span>
                        </div>
                        <span className="text-lg font-bold">{payoutPercentage}</span>
                    </>
                )}
            </Button>
            
             <div className="text-xs text-muted-foreground flex items-center justify-between pt-2">
                <span>Pagamento</span>
                <span className="font-semibold text-foreground">{payout} USD</span>
             </div>
            <Button
                variant="outline"
                className="w-full h-14 bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20 hover:text-red-700 flex justify-between items-center"
                onClick={() => handleTrade("fall")}
                disabled={!!loading}
            >
                {loading === "fall" ? ( <Loader2 className="h-5 w-5 animate-spin" /> ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <ArrowDown className="h-5 w-5" />
                            <span className="font-semibold">Fall</span>
                        </div>
                        <span className="text-lg font-bold">{payoutPercentage}</span>
                    </>
                )}
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
