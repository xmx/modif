package echox

import (
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/openai/openai-go/v3"
	"github.com/sourcegraph/jsonrpc2"
)

func HandleError(c *echo.Context, err error) {
	resp := c.Response()
	if ersp, ok := resp.(*echo.Response); ok && ersp.Committed {
		return
	}

	code := http.StatusBadRequest
	msg := new(AIErrorMessage)
	switch ev := err.(type) {
	case *openai.Error:
		msg = &AIErrorMessage{
			Code:    ev.Code,
			Message: ev.Message,
			Param:   ev.Param,
			Type:    ev.Type,
		}
		code = ev.StatusCode
	case *jsonrpc2.Error:
		code = int(ev.Code)
		msg.Message = ev.Message
	default:
		msg.Message = err.Error()
	}

	_ = c.JSON(code, msg)
}

type AIErrorMessage struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Param   string `json:"param"`
	Type    string `json:"type"`
}

type AIErrorResponse struct {
	Error *AIErrorMessage `json:"error"`
}
