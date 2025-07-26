import { GoalCard } from "@/components/goals/goal-card";

const goals = [
  {
    id: "1",
    name: "Viagem para o Japão",
    currentAmount: 7500,
    targetAmount: 12000,
    imageUrl: "https://placehold.co/600x400.png",
    imageHint: "japan temple"
  },
  {
    id: "2",
    name: "Entrada da Casa Própria",
    currentAmount: 27500,
    targetAmount: 50000,
    imageUrl: "https://placehold.co/600x400.png",
    imageHint: "dream house"
  },
  {
    id: "3",
    name: "Fundo de Emergência",
    currentAmount: 8500,
    targetAmount: 10000,
    imageUrl: "https://placehold.co/600x400.png",
    imageHint: "saving money"
  },
  {
    id: "4",
    name: "Renovação da Cozinha",
    currentAmount: 2500,
    targetAmount: 15000,
    imageUrl: "https://placehold.co/600x400.png",
    imageHint: "modern kitchen"
  },
];

export default function GoalsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Metas Financeiras
        </h1>
      </div>
      <p className="text-muted-foreground">
        Acompanhe seu progresso e mantenha-se motivado para alcançar seus sonhos.
      </p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} />
        ))}
      </div>
    </div>
  );
}
