package restapi

import (
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/openai/openai-go/v3"
	"github.com/xmx/modif/application/aigate/aiflow"
	"github.com/xmx/modif/application/aigate/process"
	"github.com/xmx/modif/application/echox"
)

type ChatCompletion struct {
	proc *process.ChatCompletion
}

func NewChatCompletion(proc *process.ChatCompletion) *ChatCompletion {
	return &ChatCompletion{
		proc: proc,
	}
}

func (cc *ChatCompletion) RegisterHTTP(g echox.EchoRoute) error {
	v1 := g.V1.Group
	v1.POST("/chat/completions", cc.completions)
	v1.GET("/models", cc.models)

	return nil
}

//goland:noinspection GoUnhandledErrorResult
func (cc *ChatCompletion) completions(c *echo.Context) error {
	flag := echox.CheckFlag(c)
	flag.OpenAI = true

	w, r := c.Response(), c.Request()
	var params openai.ChatCompletionNewParams
	if err := c.Bind(&params); err != nil {
		return err
	}

	clientIP := c.RealIP()
	rc := aiflow.NewRequestContext(w, r, clientIP)

	return cc.proc.Completions(rc, params)
}

func (cc *ChatCompletion) models(c *echo.Context) error {
	flag := echox.CheckFlag(c)
	flag.OpenAI = true

	ctx := c.Request().Context()
	ret, _ := cc.proc.Models(ctx)

	return c.JSON(http.StatusOK, ret)
}
