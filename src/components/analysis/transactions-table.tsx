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
    merchant: "Pagamento de Aluguel",
    category: "Moradia",
    date: "2024-08-01",
    amount: 1800.0,
  },
  {
    merchant: "Supermercado Pão de Açúcar",
    category: "Alimentação",
    date: "2024-08-05",
    amount: 850.25,
  },
  {
    merchant: "Posto Shell",
    category: "Transporte",
    date: "2024-08-10",
    amount: 150.0,
  },
  {
    merchant: "Cinema Kinoplex",
    category: "Lazer",
    date: "2024-08-12",
    amount: 85.0,
  },
   {
    merchant: "Amazon.com.br",
    category: "Compras",
    date: "2024-08-15",
    amount: 250.99,
  },
  {
    merchant: "Uber",
    category: "Transporte",
    date: "2024-08-18",
    amount: 45.5,
  },
  {
    merchant: "Padaria",
    category: "Alimentação",
    date: "2024-08-20",
    amount: 55.30,
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
                  {new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
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
