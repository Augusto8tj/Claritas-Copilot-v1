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
    amount: 15.49,
    status: "Upcoming",
  },
  {
    recipient: "AT&T Internet",
    dueDate: "2024-08-28",
    amount: 80.0,
    status: "Upcoming",
  },
  {
    recipient: "Edison Electric",
    dueDate: "2024-09-01",
    amount: 124.5,
    status: "Upcoming",
  },
  {
    recipient: "Chase Credit Card",
    dueDate: "2024-09-05",
    amount: 250.0,
    status: "Upcoming",
  },
   {
    recipient: "Spotify",
    dueDate: "2024-08-15",
    amount: 10.99,
    status: "Paid",
  },
];

export function UpcomingBills() {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid':
        return <Badge variant="secondary">Paid</Badge>;
      case 'Upcoming':
        return <Badge variant="outline" className="border-accent/50 text-accent">Upcoming</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Upcoming Bills</CardTitle>
        <CardDescription>
          Keep track of your upcoming payments to avoid late fees.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Due Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.map((bill, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{bill.recipient}</TableCell>
                 <TableCell className="text-center">{getStatusBadge(bill.status)}</TableCell>
                <TableCell className="text-center">{new Date(bill.dueDate).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">${bill.amount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
