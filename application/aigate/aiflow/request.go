package aiflow

import (
	"net/http"
	"uuid"
)

type RequestContext struct {
	Response  http.ResponseWriter
	Request   *http.Request
	RequestID string
}

func NewRequestContext(w http.ResponseWriter, r *http.Request) *RequestContext {
	return &RequestContext{
		Response:  w,
		Request:   r,
		RequestID: uuid.New().String(),
	}
}
