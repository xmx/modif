package aiflow

import (
	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/responses"
)

type hubRefer struct {
	hub Huber
}

func (hr *hubRefer) ChatCompletionNew(rc *RequestContext, params openai.ChatCompletionNewParams) (openai.ChatCompletionNewParams, error) {
	var err error
	for _, cc := range hr.allChatCompletion() {
		params, err = cc.ChatCompletionNew(rc, params)
		if err != nil {
			break
		}
	}

	return params, err
}

func (hr *hubRefer) ChatCompletionChunk(rc *RequestContext, chunk openai.ChatCompletionChunk) {
	for _, cc := range hr.allChatCompletion() {
		cc.ChatCompletionChunk(rc, chunk)
	}
}

func (hr *hubRefer) ChatCompletionDone(rc *RequestContext) {
	for _, cc := range hr.allChatCompletion() {
		cc.ChatCompletionDone(rc)
	}
}

func (hr *hubRefer) ChatCompletionError(rc *RequestContext, err error) {
	for _, cc := range hr.allChatCompletion() {
		cc.ChatCompletionError(rc, err)
	}
}

func (hr *hubRefer) ResponseNew(rc *RequestContext, params responses.ResponseNewParams) (responses.ResponseNewParams, error) {
	var err error
	for _, rs := range hr.allResponse() {
		params, err = rs.ResponseNew(rc, params)
		if err != nil {
			break
		}
	}

	return params, err
}

func (hr *hubRefer) ResponseChunk(rc *RequestContext, chunk responses.ResponseStreamEventUnion) {
	for _, rs := range hr.allResponse() {
		rs.ResponseChunk(rc, chunk)
	}
}

func (hr *hubRefer) ResponseDone(rc *RequestContext) {
	for _, rs := range hr.allResponse() {
		rs.ResponseDone(rc)
	}
}

func (hr *hubRefer) ResponseError(rc *RequestContext, err error) {
	for _, rs := range hr.allResponse() {
		rs.ResponseError(rc, err)
	}
}

func (hr *hubRefer) allChatCompletion() []ChatCompletion {
	return hr.hub.AllChatCompletion()
}

func (hr *hubRefer) allResponse() []Response {
	return hr.hub.AllResponse()
}
