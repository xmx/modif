package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"runtime/debug"
	"syscall"

	"github.com/xmx/modif/launch"
)

func main() {
	set := flag.NewFlagSet(os.Args[0], flag.ExitOnError)
	cfg := set.String("c", "resources/config/application.jsonc", "配置文件")
	// 	ver := set.Bool("v", false, "打印版本")
	_ = set.Parse(os.Args[1:])

	// 设置崩溃信息输出位置。
	for _, name := range []string{"resources/.crash.txt", ".crash.txt"} {
		if crash, _ := os.Create(name); crash != nil {
			_ = debug.SetCrashOutput(crash, debug.CrashOptions{})
			_ = crash.Close() // 设置后可以关闭。
			break
		}
	}

	sigs := []os.Signal{syscall.SIGINT, syscall.SIGTERM}
	ctx, cancel := signal.NotifyContext(context.Background(), sigs...)
	defer cancel()

	slog.Info("按 Ctrl+C 停止运行")
	err := launch.Run(ctx, *cfg)
	cause := context.Cause(ctx)

	slog.Warn("程序已停止运行", "err", err, "cause", cause)
}
