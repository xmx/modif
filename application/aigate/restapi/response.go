package restapi

import (
	"github.com/labstack/echo/v5"
	"github.com/openai/openai-go/v3/responses"
	"github.com/xmx/modif/application/aigate/aiflow"
	"github.com/xmx/modif/application/aigate/process"
	"github.com/xmx/modif/application/echox"
)

type Response struct {
	proc *process.Response
}

func NewResponse(proc *process.Response) *Response {
	return &Response{
		proc: proc,
	}
}

func (rsp *Response) RegisterRoute(g echox.Group) {
	g.V1.Group.POST("/responses", rsp.responses)
}

func (rsp *Response) responses(c *echo.Context) error {
	flag := echox.CheckFlag(c)
	flag.OpenAI = true

	w, r := c.Response(), c.Request()
	var params responses.ResponseNewParams
	if err := c.Bind(&params); err != nil {
		return err
	}

	clientIP := c.RealIP()
	rc := aiflow.NewRequestContext(w, r, clientIP)

	return rsp.proc.Responses(rc, params)
}
