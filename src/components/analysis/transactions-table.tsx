import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Utensils,
  Home,
  Car,
  Ticket,
  ShoppingCart,
  MoreHorizontal,
} from "lucide-react";

const transactions = [
  {
    merchant: "Whole Foods",
    category: "Alimentação",
    date: "2024-08-20",
    amount: 125.6,
  },
  {
    merchant: "Amazon",
    category: "Compras",
    date: "2024-08-19",
    amount: 78.99,
  },
  {
    merchant: "Pagamento de Hipoteca",
    category: "Moradia",
    date: "2024-08-18",
    amount: 1800.0,
  },
  {
    merchant: "Cinemas AMC",
    category: "Lazer",
    date: "2024-08-17",
    amount: 45.0,
  },
  {
    merchant: "Exxon Mobil",
    category: "Transporte",
    date: "2024-08-16",
    amount: 55.2,
  },
  {
    merchant: "Target",
    category: "Compras",
    date: "2024-08-15",
    amount: 112.4,
  },
];

const categoryIcons: { [key: string]: React.ReactNode } = {
  "Alimentação": <Utensils className="h-4 w-4 text-muted-foreground" />,
  "Compras": <ShoppingCart className="h-4 w-4 text-muted-foreground" />,
  "Moradia": <Home className="h-4 w-4 text-muted-foreground" />,
  "Transporte": <Car className="h-4 w-4 text-muted-foreground" />,
  "Lazer": <Ticket className="h-4 w-4 text-muted-foreground" />,
  "Outros": <MoreHorizontal className="h-4 w-4 text-muted-foreground" />,
};

export function TransactionsTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Transações Recentes</CardTitle>
        <CardDescription>
          Uma lista de suas transações recentes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Comerciante</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{t.merchant}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {categoryIcons[t.category] || categoryIcons["Outros"]}
                    {t.category}
                  </div>
                </TableCell>
                <TableCell>
                  {new Date(t.date).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell className="text-right">
                  -R${t.amount.toFixed(2).replace('.', ',')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
