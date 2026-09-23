import { TooltipProvider } from "@/components/ui/tooltip";
import { useStore } from "@/hooks/useStore";
import { usePathname } from "@/lib/router";
import { AppLayout } from "@/components/AppLayout";
import { Sidebar } from "@/components/Sidebar";
import { ConversationView } from "@/components/ConversationView";
import { AuditPanel } from "@/components/AuditPanel";
import { AdminPage } from "@/pages/AdminPage";

export default function App() {
  const store = useStore();
  const pathname = usePathname();

  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <TooltipProvider>
      <AppLayout
        connected={store.connected}
        onToggleConnection={store.toggleConnection}
        rewrite={store.rewrite}
        onToggleRewrite={store.toggleRewrite}
      >
        {isAdmin ? (
          <AdminPage />
        ) : (
          <div className="flex h-full">
            <Sidebar
              sessions={store.sessions}
              selectedSessionId={store.selectedSessionId}
              onSelectSession={store.selectSession}
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
        )}
      </AppLayout>
    </TooltipProvider>
  );
}