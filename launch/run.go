package launch

import (
	"context"
	"crypto/tls"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/NVIDIA/gontainer/v2"
	"github.com/labstack/echo/v5"
	"github.com/xmx/modif/application/aigate/aiflow"
	"github.com/xmx/modif/application/aigate/process"
	gateapi "github.com/xmx/modif/application/aigate/restapi"
	"github.com/xmx/modif/application/echox"
	manaapi "github.com/xmx/modif/application/manager/restapi"
	"github.com/xmx/modif/component"
	"github.com/xmx/modif/config"
	"github.com/xmx/modif/library/netutil"
	"github.com/xmx/modif/library/tlscert"
)

func Run(ctx context.Context, cfg string) error {
	c, err := config.JSONC(cfg, 256*1024)
	if err != nil {
		return err
	}

	return Exec(ctx, c)
}

//goland:noinspection GoUnhandledErrorResult
func Exec(ctx context.Context, cfg *config.Config) error {
	log := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{AddSource: true}))
	e := echo.New()
	eg := echox.NewGroup(e)

	opts := []gontainer.Option{
		gontainer.NewService(cfg),        // 配置文件
		gontainer.NewService(cfg.Server), // 配置文件
		gontainer.NewService(cfg.OpenAI), // 配置文件
		gontainer.NewService(log),        // 全局日志

		gontainer.NewFactory(echox.NewWebsocketUpgrade), // Websocket Upgrade
		gontainer.NewFactory(aiflow.NewHub),
		gontainer.NewFactory(component.NewOpenAI),

		// AI Process
		gontainer.NewFactory(process.NewChatCompletion),
		gontainer.NewFactory(process.NewResponse),

		// AI API
		gontainer.NewFactory(gateapi.NewChatCompletion),
		gontainer.NewFactory(gateapi.NewResponse),

		// Manager API
		gontainer.NewFactory(manaapi.NewInspect),

		gontainer.NewEntrypoint(eg.Registers), // 注册路由
	}
	if err := gontainer.Run(opts...); err != nil {
		return err
	}

	// 最后管理容器组件
	manaapi.NewInject(opts).RegisterRoute(eg)

	selfTLS := tlscert.NewMatch(nil, log) // 临时自签证书
	addr := cfg.Server.Addr
	srv := &http.Server{
		Addr:              addr,
		Handler:           e,
		ReadHeaderTimeout: 10 * time.Second,
		TLSConfig:         &tls.Config{GetCertificate: selfTLS.GetCertificate},
	}
	accessAddr := netutil.ResolvableAddr(addr)
	openURL := &url.URL{Scheme: "http", Host: accessAddr}
	log.Info("访问地址", "url", openURL.String())

	var err error
	errch := make(chan error)
	go serveHTTP(errch, srv, false, log)
	defer shutdownHTTP(ctx, srv, 5*time.Second)

	select {
	case err = <-errch:
	case <-ctx.Done():
		err = ctx.Err()
	}

	cause := context.Cause(ctx)
	log.Error("程序停止运行", "err", err, "cause", cause)

	return err
}
