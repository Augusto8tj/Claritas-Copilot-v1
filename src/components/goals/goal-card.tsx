import Image from "next/image";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { GoalProjectionDialog } from "./goal-projection-dialog";
import type { Goal } from "@/lib/types";


interface GoalCardProps {
  goal: Goal;
}

export function GoalCard({ goal }: GoalCardProps) {
  const progress = (goal.currentAmount / goal.targetAmount) * 100;

  return (
    <Card className="flex flex-col">
      <CardHeader className="p-0">
        <div className="relative h-40 w-full">
          <Image
            src={goal.imageUrl}
            alt={goal.name}
            layout="fill"
            objectFit="cover"
            className="rounded-t-lg"
            data-ai-hint={goal.imageHint}
          />
        </div>
        <div className="p-6 pb-2">
            <CardTitle className="font-headline text-xl">{goal.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-2">
          <Progress value={progress} />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>R${goal.currentAmount.toLocaleString('pt-BR')}</span>
            <span>R${goal.targetAmount.toLocaleString('pt-BR')}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <GoalProjectionDialog goal={goal} />
      </CardFooter>
    </Card>
  );
}
