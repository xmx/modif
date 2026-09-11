package aiflow

import (
	"net/http"
	"strings"
	"uuid"
)

type RequestContext struct {
	Response  http.ResponseWriter
	Request   *http.Request
	RequestID string
	ClientIP  string
}

func NewRequestContext(w http.ResponseWriter, r *http.Request, clientIP string) *RequestContext {
	return &RequestContext{
		Response:  w,
		Request:   r,
		RequestID: findRequestID(r.Header),
		ClientIP:  clientIP,
	}
}

func findRequestID(header http.Header) string {
	keys := []string{"X-Request-Id", "X-Conversation-Request-Id"}
	for _, key := range keys {
		if val := strings.TrimSpace(header.Get(key)); val != "" {
			return val
		}
	}

	return uuid.New().String()
}
