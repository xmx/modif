package aiflow

import (
	"github.com/openai/openai-go/v3"
)

type ChatCompletion interface {
	ChatCompletionNew(rc *RequestContext, params openai.ChatCompletionNewParams) (openai.ChatCompletionNewParams, error)
	ChatCompletionChunk(rc *RequestContext, chunk openai.ChatCompletionChunk)
	ChatCompletionUsage(rc *RequestContext, usage openai.CompletionUsage)
	ChatCompletionDone(rc *RequestContext)
	ChatCompletionError(rc *RequestContext, err error)
}

type ChatCompletions []ChatCompletion

func (ccs ChatCompletions) ChatCompletionNew(rc *RequestContext, params openai.ChatCompletionNewParams) (openai.ChatCompletionNewParams, error) {
	var err error
	for _, cc := range ccs {
		if params, err = cc.ChatCompletionNew(rc, params); err != nil {
			return openai.ChatCompletionNewParams{}, err
		}
	}

	return params, err
}

func (ccs ChatCompletions) ChatCompletionChunk(rc *RequestContext, chunk openai.ChatCompletionChunk) {
	for _, cc := range ccs {
		cc.ChatCompletionChunk(rc, chunk)
	}
}

func (ccs ChatCompletions) ChatCompletionUsage(rc *RequestContext, usage openai.CompletionUsage) {
	for _, cc := range ccs {
		cc.ChatCompletionUsage(rc, usage)
	}
}

func (ccs ChatCompletions) ChatCompletionDone(rc *RequestContext) {
	for _, cc := range ccs {
		cc.ChatCompletionDone(rc)
	}
}

func (ccs ChatCompletions) ChatCompletionError(rc *RequestContext, err error) {
	for _, cc := range ccs {
		cc.ChatCompletionError(rc, err)
	}
}

type chatCompletionRefer struct {
	hub *flowHub
}

func (ccr *chatCompletionRefer) ChatCompletionNew(rc *RequestContext, params openai.ChatCompletionNewParams) (openai.ChatCompletionNewParams, error) {
	return ccr.fresh().ChatCompletionNew(rc, params)
}

func (ccr *chatCompletionRefer) ChatCompletionChunk(rc *RequestContext, chunk openai.ChatCompletionChunk) {
	ccr.fresh().ChatCompletionChunk(rc, chunk)
}

func (ccr *chatCompletionRefer) ChatCompletionUsage(rc *RequestContext, usage openai.CompletionUsage) {
	ccr.fresh().ChatCompletionUsage(rc, usage)
}

func (ccr *chatCompletionRefer) ChatCompletionDone(rc *RequestContext) {
	ccr.fresh().ChatCompletionDone(rc)
}

func (ccr *chatCompletionRefer) ChatCompletionError(rc *RequestContext, err error) {
	ccr.fresh().ChatCompletionError(rc, err)
}

func (ccr *chatCompletionRefer) fresh() ChatCompletion {
	return ccr.hub.loadChatCompletions()
}
