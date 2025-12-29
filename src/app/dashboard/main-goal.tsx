
import { getGoals } from "@/app/actions/financial-data-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { GoalProgressChart } from "./goal-progress-chart";
import { auth } from "@/lib/firebase";

export async function MainGoal() {
  const userId = auth.currentUser?.uid;
  if (!userId) {
     return <Card><CardHeader><CardTitle className="font-headline">Metas</CardTitle><CardDescription>Faça login para ver suas metas.</CardDescription></CardHeader></Card>
  }
  const goals = await getGoals(userId);

  if (!goals || goals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Metas</CardTitle>
          <CardDescription>Nenhuma meta encontrada.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Vá para a página de Metas para adicionar sua primeira.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Acompanhamento de Metas</CardTitle>
        <CardDescription>
          Veja o progresso de suas metas financeiras.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center p-6">
        <Carousel className="w-full max-w-xs" opts={{ loop: true }}>
          <CarouselContent>
            {goals.map((goal) => (
              <CarouselItem key={goal.id}>
                <div className="p-1 text-center">
                  <h3 className="font-semibold text-lg">{goal.name}</h3>
                  <GoalProgressChart goal={goal} />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </CardContent>
    </Card>
  );
}
