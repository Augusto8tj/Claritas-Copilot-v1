// /src/app/profile/page.tsx
"use client";

import { useState, useRef } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Pencil } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(1, "O nome não pode estar vazio."),
  email: z.string().email("Email inválido."),
});

type FormValues = z.infer<typeof formSchema>;

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user?.displayName || "",
      email: user?.email || "",
    },
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    if (!user) return;
    setLoading(true);
    try {
      await updateProfile(user, { displayName: data.name });
      toast({
        title: "Perfil Atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao Atualizar",
        description: "Não foi possível salvar suas informações. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({
          variant: "destructive",
          title: "Arquivo Inválido",
          description: "Por favor, selecione um arquivo de imagem.",
        });
        return;
      }
      handleImageUpload(file);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!user) return;
    setIsUploading(true);

    // Simulação de upload para um serviço de armazenamento
    await new Promise(resolve => setTimeout(resolve, 1500));
    const newPhotoURL = `https://placehold.co/100x100.png?text=${user.displayName?.[0].toUpperCase()}`;

    try {
      // Em um app real, você faria o upload para o Firebase Storage e obteria a URL
      // await uploadBytes(storageRef, file);
      // const newPhotoURL = await getDownloadURL(storageRef);

      await updateProfile(user, { photoURL: newPhotoURL });
      
      // Atualiza o estado do usuário no contexto
      const updatedUser = { ...user, photoURL: newPhotoURL };
      updateUser(updatedUser);


      toast({
        title: "Foto Atualizada",
        description: "Sua foto de perfil foi alterada com sucesso.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro no Upload",
        description: "Não foi possível atualizar sua foto. Tente novamente.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <h1 className="text-3xl font-bold tracking-tight font-headline">
        Perfil
      </h1>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Suas Informações</CardTitle>
          <CardDescription>
            Veja e atualize suas informações pessoais aqui.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-4">
            <Avatar className="h-24 w-24">
              {user.photoURL ? (
                <AvatarImage src={user.photoURL} alt={user.displayName || "User"} />
              ) : (
                <AvatarImage src="https://placehold.co/100x100.png" alt="@usuario" data-ai-hint="user avatar" />
              )}
              <AvatarFallback>{user.displayName?.[0].toUpperCase() || "U"}</AvatarFallback>
            </Avatar>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="mr-2 h-4 w-4" />
              )}
              Alterar Foto
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
            />
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <Label>Nome</Label>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <Label>Email</Label>
                      <FormControl>
                        <Input type="email" {...field} disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
