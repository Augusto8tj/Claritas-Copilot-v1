
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

export type Transaction = {
  id: string; // Changed to string to match Firestore document ID
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
}
