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
	g.V1.POST("/responses", rsp.responses)
}

func (rsp *Response) responses(c *echo.Context) error {
	w, r := c.Response(), c.Request()
	var params responses.ResponseNewParams
	if err := c.Bind(&params); err != nil {
		return err
	}
	rc := aiflow.NewRequestContext(w, r)

	return rsp.proc.Responses(rc, params)
}
