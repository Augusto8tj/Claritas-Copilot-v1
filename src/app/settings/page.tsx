import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <h1 className="text-3xl font-bold tracking-tight font-headline">
        Configurações
      </h1>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Notificações</CardTitle>
          <CardDescription>
            Gerencie como você recebe notificações do aplicativo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">Notificações por Email</Label>
              <p className="text-sm text-muted-foreground">
                Receba insights e alertas importantes por email.
              </p>
            </div>
            <Switch id="email-notifications" defaultChecked />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label htmlFor="push-notifications">Notificações Push</Label>
               <p className="text-sm text-muted-foreground">
                Receba alertas em tempo real no seu dispositivo.
              </p>
            </div>
            <Switch id="push-notifications" />
          </div>
        </CardContent>
      </Card>
        <Card>
        <CardHeader>
          <CardTitle className="font-headline">Tema</CardTitle>
          <CardDescription>
            Personalize a aparência do aplicativo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label htmlFor="dark-mode">Modo Escuro</Label>
               <p className="text-sm text-muted-foreground">
                Ative para uma experiência com menos brilho.
              </p>
            </div>
            <Switch id="dark-mode" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
