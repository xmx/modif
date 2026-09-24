import { useState } from "react";
import { Loader2Icon, KeyRoundIcon, LogInIcon } from "lucide-react";
import { navigate } from "@/lib/router";
import { saveToken } from "@/lib/auth";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ModifLogo } from "@/components/ModifLogo";

export function LoginPage() {
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const value = token.trim();
    if (!value) {
      toast({ title: "请输入访问密钥", variant: "warning" });
      return;
    }

    setSubmitting(true);
    try {
      // 用轻量的受保护接口校验密钥，通过后再落地保存并进入首页。
      const resp = await fetch("/api/route/webui", {
        headers: { Authorization: `Bearer ${value}` },
      });
      if (!resp.ok) {
        toast({ title: "访问密钥无效", detail: "请确认访问密钥是否正确", variant: "error" });
        return;
      }
      saveToken(value);
      navigate("/");
    } catch {
      toast({ title: "网络请求失败", detail: "请检查后端服务是否可用", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <div className="flex justify-center">
          <ModifLogo className="size-8 text-primary" />
        </div>
        <CardContent>
          <div className="relative">
            <KeyRoundIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="访问密钥"
              autoFocus
              disabled={submitting}
              className="pr-11 pl-8"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submitting) void submit();
              }}
            />
            <Button
              onClick={() => void submit()}
              disabled={submitting}
              size="icon"
              variant="ghost"
              aria-label="登录"
              title="登录"
              className="absolute top-1/2 right-1 size-7 -translate-y-1/2 active:translate-y-[-50%] active:not-aria-[haspopup]:translate-y-[-50%]"
            >
              {submitting ? <Loader2Icon className="animate-spin" /> : <LogInIcon />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}