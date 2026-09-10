package launch

import (
	"context"
	"crypto/tls"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/xmx/modif/application/aigate/aiflow"
	"github.com/xmx/modif/application/aigate/process"
	aiapi "github.com/xmx/modif/application/aigate/restapi"
	"github.com/xmx/modif/application/echox"
	manaapi "github.com/xmx/modif/application/manager/restapi"
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
	log := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{}))
	cli := openai.NewClient(
		option.WithBaseURL(cfg.OpenAI.BaseURL),
		option.WithAPIKey(cfg.OpenAI.APIKey),
	)
	hub := aiflow.NewHub()

	chatCompletionProc := process.NewChatCompletion(cli, hub, log)
	routes := echox.RouteRegisters{
		aiapi.NewChatCompletion(chatCompletionProc),
		manaapi.NewInspect(hub),
	}

	e := echo.New()
	eg := echox.NewGroup(e)
	routes.RegisterRoute(eg)

	selfTLS := tlscert.NewMatch(nil, log) // 临时自签证书
	const addr = "0.0.0.0:8866"
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

	return nil
}
