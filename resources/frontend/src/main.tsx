import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'highlight.js/styles/atom-one-dark.css'
import App from './App.tsx'
import { ToastProvider } from './components/ui/toast'

// 启动即应用保存的主题，保证登录页这类不经过 AppLayout（含 ThemeToggle）的页面也能自适应 dark/light。
type Theme = "light" | "dark" | "system";
function applyRootTheme(t: Theme) {
  const isDark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}
const initialTheme = (localStorage.getItem("theme") as Theme | null) || "system";
applyRootTheme(initialTheme);
if (initialTheme === "system") {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", () => applyRootTheme("system"));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
