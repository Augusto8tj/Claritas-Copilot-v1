
"use client";

import { MarketChart } from "@/components/trading/market-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp } from "lucide-react";


const digitalOptionsTypes = [
    'Rise/Fall', 'Higher/Lower', 'EndBetweens', 'StaysBetween', 
    'Lookbacks', 'Touch/NoTouch', 'OnlyUps/Downs', 'Highest/Lowest', 
    'ResetCall', 'AsianUpDown', 'Digit:Matches/Differs', 
    'Digit:Even/Odd', 'Digit:Over/Under'
];

export default function DerivTraderPage() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Deriv Trader
        </h1>
      </div>
      <p className="text-muted-foreground">
        Nossa plataforma integrada para negociação de Opções e Multiplicadores.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Acompanhamento de Ativo (PETR4)</CardTitle>
              <CardDescription>
                Visualização do desempenho do ativo em tempo real (simulado).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MarketChart />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-1">
          <Card>
            <Tabs defaultValue="multipliers">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="multipliers">Multiplicadores</TabsTrigger>
                <TabsTrigger value="options">Opções</TabsTrigger>
              </TabsList>
              
              {/* Multipliers Tab */}
              <TabsContent value="multipliers">
                <CardHeader>
                  <CardTitle className="font-headline">Multiplicadores</CardTitle>
                  <CardDescription>
                    Amplie seus lucros com risco limitado ao seu investimento.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Ativo</Label>
                        <Select defaultValue="vol100">
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione o ativo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="vol100">Índice de Volatilidade 100</SelectItem>
                            <SelectItem value="petr4" disabled>PETR4 (em breve)</SelectItem>
                        </SelectContent>
                        </Select>
                    </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="stake-multiplier">Stake (USD)</Label>
                      <Input id="stake-multiplier" type="number" placeholder="10.00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="multiplier">Multiplicador</Label>
                      <Input id="multiplier" type="number" placeholder="x100" />
                    </div>
                  </div>
                  <div className="space-y-2">
                      <Label>Gerenciamento de Risco (Opcional)</Label>
                       <div className="grid grid-cols-2 gap-4">
                         <Input type="number" placeholder="Take Profit" aria-label="Take Profit" />
                         <Input type="number" placeholder="Stop Loss" aria-label="Stop Loss" />
                       </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                      <Button variant="outline" className="h-12 bg-green-50/50 text-green-600 border-green-200 hover:bg-green-100 hover:text-green-700">
                          <ArrowUp className="mr-2 h-5 w-5" /> Sobe
                      </Button>
                       <Button variant="outline" className="h-12 bg-red-50/50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700">
                          <ArrowDown className="mr-2 h-5 w-5" /> Desce
                      </Button>
                  </div>
                </CardContent>
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
                   <div className="space-y-2">
                        <Label>Tipo de Opção</Label>
                        <Select defaultValue="Rise/Fall">
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            {digitalOptionsTypes.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="duration">Duração</Label>
                            <Input id="duration" placeholder="5 ticks" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="stake-options">Stake (USD)</Label>
                            <Input id="stake-options" type="number" placeholder="10.00" />
                        </div>
                    </div>
                    <div className="space-y-2 pt-2">
                        <p className="text-sm text-center text-muted-foreground">
                            Pagamento Potencial: $19.50
                        </p>
                    </div>
                     <div className="grid grid-cols-2 gap-4 pt-2">
                      <Button variant="outline" className="h-12 bg-green-50/50 text-green-600 border-green-200 hover:bg-green-100 hover:text-green-700">
                          <ArrowUp className="mr-2 h-5 w-5" /> Rise
                      </Button>
                       <Button variant="outline" className="h-12 bg-red-50/50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700">
                          <ArrowDown className="mr-2 h-5 w-5" /> Fall
                      </Button>
                  </div>
                </CardContent>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
