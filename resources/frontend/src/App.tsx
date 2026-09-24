import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useStore } from "@/hooks/useStore";
import { usePathname, navigate } from "@/lib/router";
import { useAuthToken } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import { Sidebar } from "@/components/Sidebar";
import { ConversationView } from "@/components/ConversationView";
import { AuditPanel } from "@/components/AuditPanel";
import { AdminPage } from "@/pages/AdminPage";
import { LoginPage } from "@/pages/LoginPage";

export default function App() {
  const store = useStore();
  const pathname = usePathname();
  const token = useAuthToken();

  const isLogin = pathname === "/login";
  const authenticated = token.trim().length > 0;

  // 未登录 → 登录页；已登录访问登录页 → 回到首页。
  useEffect(() => {
    if (!authenticated && !isLogin) navigate("/login");
    else if (authenticated && isLogin) navigate("/");
  }, [authenticated, isLogin]);

  if (!authenticated || isLogin) {
    return (
      <TooltipProvider>
        <LoginPage />
      </TooltipProvider>
    );
  }

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
              connected={store.connected}
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