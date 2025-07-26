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
import { Badge } from "../ui/badge";

const bills = [
  {
    recipient: "Netflix",
    dueDate: "2024-08-25",
    amount: 39.90,
    status: "Próxima",
  },
  {
    recipient: "Internet Claro",
    dueDate: "2024-08-28",
    amount: 99.90,
    status: "Próxima",
  },
  {
    recipient: "CPFL Energia",
    dueDate: "2024-09-01",
    amount: 124.5,
    status: "Próxima",
  },
  {
    recipient: "Cartão de Crédito Nubank",
    dueDate: "2024-09-05",
    amount: 850.0,
    status: "Próxima",
  },
   {
    recipient: "Spotify",
    dueDate: "2024-08-15",
    amount: 21.90,
    status: "Paga",
  },
];

export function UpcomingBills() {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Paga':
        return <Badge variant="secondary">Paga</Badge>;
      case 'Próxima':
        return <Badge variant="outline" className="border-accent/50 text-accent">Próxima</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Contas a Vencer</CardTitle>
        <CardDescription>
          Acompanhe seus próximos pagamentos para evitar multas por atraso.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Beneficiário</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Data de Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.map((bill, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{bill.recipient}</TableCell>
                 <TableCell className="text-center">{getStatusBadge(bill.status)}</TableCell>
                <TableCell className="text-center">{new Date(bill.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</TableCell>
                <TableCell className="text-right">R${bill.amount.toFixed(2).replace('.', ',')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
