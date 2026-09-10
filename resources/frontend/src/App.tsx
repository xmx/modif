import { TooltipProvider } from "@/components/ui/tooltip";
import { useStore } from "@/hooks/useStore";
import { Sidebar } from "@/components/Sidebar";
import { ConversationView } from "@/components/ConversationView";

export default function App() {
  const store = useStore();

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        <Sidebar
          sessions={store.sessions}
          selectedSessionId={store.selectedSessionId}
          connected={store.connected}
          onSelectSession={store.selectSession}
          onToggleConnection={store.toggleConnection}
        />
        <ConversationView
          sessions={store.sessions}
          selectedSessionId={store.selectedSessionId}
        />
      </div>
    </TooltipProvider>
  );
}