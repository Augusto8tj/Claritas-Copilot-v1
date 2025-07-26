"use client";

import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getGoalProjection } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { useToast } from "@/hooks/use-toast";


type Goal = {
  id: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
  imageUrl: string;
};

const formSchema = z.object({
  currentSavings: z.coerce.number().positive("Must be a positive number"),
  goalAmount: z.coerce.number().positive("Must be a positive number"),
  monthlyContribution: z.coerce.number().positive("Must be a positive number"),
  monthlyReturnRate: z.coerce
    .number()
    .min(0, "Cannot be negative")
    .max(100, "Cannot be over 100"),
});

type FormValues = z.infer<typeof formSchema>;

export function GoalProjectionDialog({ goal }: { goal: Goal }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentSavings: goal.currentAmount,
      goalAmount: goal.targetAmount,
      monthlyContribution: 500,
      monthlyReturnRate: 5,
    },
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    setLoading(true);
    setResult(null);
    const response = await getGoalProjection(data);
    
    if (response.error) {
      if(typeof response.error === 'object') {
        Object.entries(response.error).forEach(([key, value]) => {
          form.setError(key as keyof FormValues, { message: (value as string[])[0] });
        });
      } else {
         toast({
            variant: "destructive",
            title: "Projection Failed",
            description: response.error,
        });
      }
    } else if (response.success) {
      setResult(response.success);
    }
    setLoading(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset();
      setResult(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline">
          <Sparkles className="mr-2 h-4 w-4" />
          Project Goal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Project: {goal.name}</DialogTitle>
          <DialogDescription>
            See how long it will take to reach your goal. Adjust the values to
            simulate different scenarios.
          </DialogDescription>
        </DialogHeader>
        {result ? (
            <Alert className="bg-primary/5 border-primary/20">
                <Sparkles className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary font-headline">AI Projection</AlertTitle>
                <AlertDescription className="text-primary/90">
                    {result}
                </AlertDescription>
            </Alert>
        ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentSavings"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Savings ($)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="goalAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Goal Amount ($)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="monthlyContribution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Contribution ($)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="monthlyReturnRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Annual Return Rate (%)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Calculate Projection
            </Button>
          </form>
        </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
