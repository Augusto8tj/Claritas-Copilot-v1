// /src/services/financial-data-service.ts
'use server';

/**
 * @fileOverview A financial data service that interacts with Firebase Firestore.
 */
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, addDoc, query, where, doc, updateDoc, deleteDoc, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import type { Goal, BudgetCategory, Transaction, RobotPerformance } from '@/lib/types';
import { generateGoalImage } from '@/ai/flows/goal-image-generation';

import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


const PROMOTION_THRESHOLD_WINS = 10;
const PROMOTION_THRESHOLD_PROFIT = 0;

// Helper to get the current user's ID
const getUserId = (): string | null => {
    // This is a server-side service, so auth.currentUser might not be available
    // in all contexts. In a real app, you'd pass the user ID from a secure session.
    // For this environment, we'll assume it's available or handle it gracefully.
    return auth.currentUser?.uid || null;
};

// --- Transactions ---

export async function getTransactions(userId: string): Promise<Transaction[]> {
    const transactionsCol = collection(db, `users/${userId}/transactions`);
    const snapshot = await getDocs(transactionsCol);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
}

export async function addTransaction(userId: string, data: Omit<Transaction, 'id'>): Promise<string> {
    const transactionsCol = collection(db, `users/${userId}/transactions`);
    await addDoc(transactionsCol, data);
    return `Transação "${data.description}" de R$${data.amount.toFixed(2)} adicionada com sucesso.`;
}

// --- Financial Summary ---

export async function getFinancialSummary(userId: string): Promise<{ income: number; expenses: number; balance: number; }> {
    const transactions = await getTransactions(userId);
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return { income, expenses, balance: income - expenses };
}

// --- Goals ---

export async function getGoals(userId: string): Promise<Goal[]> {
    const goalsCol = collection(db, `users/${userId}/goals`);
    const snapshot = await getDocs(goalsCol);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Goal));
}

export async function addGoal(userId: string, name: string, targetAmount: number): Promise<Goal> {
    const goalsCol = collection(db, `users/${userId}/goals`);
    
    let imageUrl = "https://placehold.co/600x400.png";
    try {
        const imageResult = await generateGoalImage({ goalName: name });
        imageUrl = imageResult.imageUrl;
    } catch (error) {
        console.error("Falha ao gerar imagem da meta, usando placeholder.", error);
    }

    const newGoalData = {
        name,
        targetAmount,
        currentAmount: 0,
        imageUrl: imageUrl,
        imageHint: "new goal"
    };
    
    const docRef = await addDoc(goalsCol, newGoalData);

    return { id: docRef.id, ...newGoalData };
}

export async function deleteGoal(userId: string, goalId: string): Promise<{ success: boolean }> {
    const goalDoc = doc(db, `users/${userId}/goals`, goalId);
    await deleteDoc(goalDoc);
    return { success: true };
}

// --- Budget ---

async function getBudgetLimits(userId: string): Promise<{ [key: string]: number }> {
    const settingsDoc = doc(db, `users/${userId}/settings`, 'budget');
    const docSnap = await getDoc(settingsDoc);
    if (docSnap.exists()) {
        return docSnap.data().limits || {};
    }
    // Return default if not exists
    return {
        "Moradia": 2000, "Alimentação": 1000, "Transporte": 500,
        "Lazer": 400, "Compras": 600, "Outros": 300,
    };
}

export async function getBudgetData(userId: string): Promise<BudgetCategory[]> {
    const [transactions, budgetLimits] = await Promise.all([
        getTransactions(userId),
        getBudgetLimits(userId)
    ]);
    
    const expensesByCategory = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        const category = t.category || "Outros";
        if (!acc[category]) acc[category] = 0;
        acc[category] += t.amount;
        return acc;
      }, {} as { [key: string]: number });
  
    return Object.entries(budgetLimits).map(([name, budgeted]) => ({
      name,
      budgeted,
      spent: expensesByCategory[name] || 0,
    }));
}

export async function updateBudgetLimit(userId: string, name: string, newLimit: number): Promise<BudgetCategory | null> {
    const settingsDocRef = doc(db, `users/${userId}/settings`, 'budget');
    await setDoc(settingsDocRef, {
        [`limits.${name}`]: newLimit
    }, { merge: true });

    const transactions = await getTransactions(userId);
    const spent = transactions
        .filter(t => t.type === 'expense' && t.category === name)
        .reduce((sum, t) => sum + t.amount, 0);

    return { name, budgeted: newLimit, spent };
}

export async function getExpenseCategories(userId: string): Promise<string[]> {
    const limits = await getBudgetLimits(userId);
    return Object.keys(limits);
}

// --- General Insights (Still Mocked) ---
export async function getInsights(): Promise<string[]> {
    // This can be enhanced later to be dynamic based on user data
    return [
      "Você gastou R$150 em restaurantes. Tente cozinhar em casa para economizar.",
      "Sua maior despesa é o aluguel. Considere procurar opções mais baratas, se possível.",
      "Você está perto de atingir seu fundo de emergência! Continue assim."
    ];
}


// --- Trading Robot Performance ---

export async function saveRobotPerformance(userId: string, performanceData: RobotPerformance[]): Promise<void> {
    const performanceDocRef = doc(db, 'users', userId, 'trading', 'robotPerformance');
    const dataToSave = { performance: performanceData };

    await setDoc(performanceDocRef, dataToSave, { merge: true })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: performanceDocRef.path,
                operation: 'update',
                requestResourceData: dataToSave,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
}


export async function loadRobotPerformance(userId: string): Promise<RobotPerformance[] | null> {
    const performanceDocRef = doc(db, 'users', userId, 'trading', 'robotPerformance');
    
    try {
        const docSnap = await getDoc(performanceDocRef);
        if (docSnap.exists()) {
            return docSnap.data().performance as RobotPerformance[];
        }
        return null;
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: performanceDocRef.path,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        // Retornar nulo ou um array vazio em caso de erro para não quebrar a aplicação
        return null;
    }
}


export async function getHallOfFame(userId: string): Promise<RobotPerformance[]> {
    const performanceData = await loadRobotPerformance(userId);
    if (!performanceData) {
        return [];
    }

    const promotedRobots = performanceData.filter(
        (p) => p.wins >= PROMOTION_THRESHOLD_WINS && p.totalProfit > PROMOTION_THRESHOLD_PROFIT
    );

    promotedRobots.sort((a, b) => b.totalProfit - a.totalProfit);
    
    return promotedRobots;
}
