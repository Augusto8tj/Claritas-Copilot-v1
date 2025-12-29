
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Award, TrendingDown, TrendingUp } from "lucide-react";
import type { RobotPerformance } from "./operations-log.types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "../ui/button";
import { useMemo } from "react";

interface VirtualArenaCardProps {
    isMeritocracyOn: boolean;
    setIsMeritocracyOn: (isOn: boolean) => void;
    isCouncilAutopilotOn: boolean;
    robotPerformance: RobotPerformance[];
}

export function VirtualArenaCard({
    isMeritocracyOn,
    setIsMeritocracyOn,
    isCouncilAutopilotOn,
    robotPerformance
}: VirtualArenaCardProps) {
    
    const virtualPnl = useMemo(() => {
        return robotPerformance.reduce((acc, p) => acc + p.totalProfit, 0);
    }, [robotPerformance]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    Arena Virtual
                </CardTitle>
                <CardDescription>
                    Ative a Meritocracia para dar mais peso aos robôs com melhor desempenho.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                        <Label htmlFor="meritocracy-switch" className="font-semibold">Modo Meritocracia</Label>
                        <p className="text-sm text-muted-foreground">
                            Pondera os votos pelo desempenho.
                        </p>
                    </div>
                    <Switch 
                        id="meritocracy-switch" 
                        checked={isMeritocracyOn}
                        onCheckedChange={setIsMeritocracyOn}
                        disabled={isCouncilAutopilotOn}
                    />
                </div>

                 <div className="rounded-lg border p-3 shadow-sm space-y-2">
                     <p className="text-sm font-semibold text-muted-foreground">Desempenho Virtual da Sessão</p>
                     <div className="flex justify-between items-center">
                        <span className="text-sm">Resultado (P/L):</span>
                        <span className={cn(
                            "font-bold text-lg",
                            virtualPnl >= 0 ? "text-green-600" : "text-destructive"
                        )}>
                            {virtualPnl >= 0 ? '+' : ''}${virtualPnl.toFixed(2)}
                        </span>
                     </div>
                      <Button variant="link" asChild className="p-0 h-auto">
                        <Link href="/trading-desk">Ver Leaderboard Detalhado</Link>
                     </Button>
                </div>
            </CardContent>
        </Card>
    );
}
