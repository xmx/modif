package echox

import (
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/openai/openai-go/v3"
	"github.com/sourcegraph/jsonrpc2"
)

func HandleError(c *echo.Context, err error) {
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

//type Error struct {
//	Code    string `json:"code" api:"required"`
//	Message string `json:"message" api:"required"`
//	Param   string `json:"param" api:"required"`
//	Type    string `json:"type" api:"required"`
//	// JSON contains metadata for fields, check presence with [respjson.Field.Valid].
//	JSON struct {
//		Code        respjson.Field
//		Message     respjson.Field
//		Param       respjson.Field
//		Type        respjson.Field
//		ExtraFields map[string]respjson.Field
//		raw         string
//	} `json:"-"`
//	StatusCode int
//	Request    *http.Request
//	Response   *http.Response
//}
