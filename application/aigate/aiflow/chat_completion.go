package aiflow

import (
	"github.com/openai/openai-go/v3"
)

type ChatCompletion interface {
	ChatCompletionNew(rc *RequestContext, params openai.ChatCompletionNewParams) (openai.ChatCompletionNewParams, error)
	ChatCompletionChunk(rc *RequestContext, chunk openai.ChatCompletionChunk)
	ChatCompletionDone(rc *RequestContext)
	ChatCompletionError(rc *RequestContext, err error)
}
