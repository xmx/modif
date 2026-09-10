package restapi

import (
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

func (cc *ChatCompletion) RegisterRoute(g echox.Group) {
	g.V1.POST("/chat/completions", cc.completions)
}

//goland:noinspection GoUnhandledErrorResult
func (cc *ChatCompletion) completions(c *echo.Context) error {
	var params openai.ChatCompletionNewParams
	if err := c.Bind(&params); err != nil {
		return err
	}

	w, r := c.Response(), c.Request()
	rc := aiflow.NewRequestContext(w, r)

	return cc.proc.Completions(rc, params)
}
