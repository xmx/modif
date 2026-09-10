package wsocket

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/openai/openai-go/v3"
	"github.com/sourcegraph/jsonrpc2"
	"github.com/xmx/modif/application/aigate/aiflow"
)

type RPC struct {
	stm *jsonrpc2.Conn
}

func NewRPC(stm *jsonrpc2.Conn) *RPC {
	return &RPC{stm: stm}
}

func (wc *RPC) ChatCompletionNew(rc *aiflow.RequestContext, params openai.ChatCompletionNewParams) (openai.ChatCompletionNewParams, error) {
	const method = methodPrefix + "chat-completion-new"
	_ = wc.notify(rc, method, params)

	return params, nil
}

func (wc *RPC) ChatCompletionChunk(rc *aiflow.RequestContext, chunk openai.ChatCompletionChunk) {
	const method = methodPrefix + "chat-completion-chunk"
	_ = wc.notify(rc, method, json.RawMessage(chunk.RawJSON()))
}

func (wc *RPC) ChatCompletionUsage(rc *aiflow.RequestContext, usage openai.CompletionUsage) {
	const method = methodPrefix + "chat-completion-usage"
	_ = wc.notify(rc, method, json.RawMessage(usage.RawJSON()))
}

func (wc *RPC) ChatCompletionDone(rc *aiflow.RequestContext) {
	const method = methodPrefix + "chat-completion-done"
	_ = wc.notify(rc, method, nil)
}

func (wc *RPC) ChatCompletionError(rc *aiflow.RequestContext, err error) {
	const method = methodPrefix + "chat-completion-error"

	var params ErrorMessage
	if apierr, ok := errors.AsType[*openai.Error](err); ok {
		params.Code = apierr.Code
		params.Message = apierr.Message
	} else {
		params.Message = err.Error()
	}

	_ = wc.notify(rc, method, params)
}

func (wc *RPC) notify(rc *aiflow.RequestContext, method string, params any) error {
	meta := wc.extractMetadata(rc)
	parent := rc.Request.Context()

	ctx, cancel := context.WithTimeout(parent, 3*time.Second)
	defer cancel()

	return wc.stm.Notify(ctx, method, params, jsonrpc2.Meta(meta))
}

func (wc *RPC) extractMetadata(rc *aiflow.RequestContext) *Metadata {
	headers := []string{
		"X-Session-Id",     // opencode
		"Agent-Session-Id", // goose
	}
	var sessionID string
	for _, key := range headers {
		sessionID = rc.Request.Header.Get(key)
		if sessionID != "" {
			break
		}
	}

	return &Metadata{
		SessionID: sessionID,
		RequestID: rc.RequestID,
		UserAgent: rc.Request.UserAgent(),
	}
}
