package aiflow

import "github.com/openai/openai-go/v3/responses"

type Response interface {
	ResponseNew(rc *RequestContext, params responses.ResponseNewParams) (responses.ResponseNewParams, error)
	ResponseChunk(rc *RequestContext, chunk responses.ResponseStreamEventUnion)
	ResponseDone(rc *RequestContext)
	ResponseError(rc *RequestContext, err error)
}
