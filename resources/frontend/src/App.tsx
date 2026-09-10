import { TooltipProvider } from "@/components/ui/tooltip";
import { useStore } from "@/hooks/useStore";
import { Sidebar } from "@/components/Sidebar";
import { ConversationView } from "@/components/ConversationView";
import { AuditPanel } from "@/components/AuditPanel";

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
        <AuditPanel
          items={store.auditQueue}
          onResolve={store.resolveAudit}
          onBlock={store.blockAudit}
          onDismiss={store.dismissAudit}
        />
      </div>
    </TooltipProvider>
  );
}