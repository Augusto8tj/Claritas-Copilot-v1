import { ChatInterface } from "@/components/chat/chat-interface";

export default function ChatPage() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Chat com IA
        </h1>
      </div>
      <p className="text-muted-foreground">
        Pergunte qualquer coisa sobre suas finanças para a Claritas.
      </p>
      <div className="h-[calc(100vh-14rem)]">
        <ChatInterface />
      </div>
    </div>
  );
}
