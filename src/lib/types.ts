export type Goal = {
  id: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
  imageUrl: string;
  imageHint: string;
};

export type BudgetCategory = {
    name: string;
    budgeted: number;
    spent: number;
};
