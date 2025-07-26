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
    category: "Food & Dining",
    date: "2024-08-20",
    amount: 125.6,
  },
  {
    merchant: "Amazon",
    category: "Shopping",
    date: "2024-08-19",
    amount: 78.99,
  },
  {
    merchant: "Mortgage Payment",
    category: "Housing",
    date: "2024-08-18",
    amount: 1800.0,
  },
  {
    merchant: "AMC Theatres",
    category: "Entertainment",
    date: "2024-08-17",
    amount: 45.0,
  },
  {
    merchant: "Exxon Mobil",
    category: "Transport",
    date: "2024-08-16",
    amount: 55.2,
  },
  {
    merchant: "Target",
    category: "Shopping",
    date: "2024-08-15",
    amount: 112.4,
  },
];

const categoryIcons: { [key: string]: React.ReactNode } = {
  "Food & Dining": <Utensils className="h-4 w-4 text-muted-foreground" />,
  Shopping: <ShoppingCart className="h-4 w-4 text-muted-foreground" />,
  Housing: <Home className="h-4 w-4 text-muted-foreground" />,
  Transport: <Car className="h-4 w-4 text-muted-foreground" />,
  Entertainment: <Ticket className="h-4 w-4 text-muted-foreground" />,
  Other: <MoreHorizontal className="h-4 w-4 text-muted-foreground" />,
};

export function TransactionsTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Recent Transactions</CardTitle>
        <CardDescription>
          A list of your recent transactions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Merchant</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{t.merchant}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {categoryIcons[t.category] || categoryIcons["Other"]}
                    {t.category}
                  </div>
                </TableCell>
                <TableCell>
                  {new Date(t.date).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  -${t.amount.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
