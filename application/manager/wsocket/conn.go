package wsocket

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"sync/atomic"
	"time"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/responses"
	"github.com/sourcegraph/jsonrpc2"
	"github.com/xmx/modif/application/aigate/aiflow"
)

type RPC struct {
	stm *jsonrpc2.Conn
	rew *atomic.Bool
}

func NewRPC(stm *jsonrpc2.Conn, rewrite *atomic.Bool) *RPC {
	return &RPC{stm: stm, rew: rewrite}
}

func (wc *RPC) ChatCompletionNew(rc *aiflow.RequestContext, params openai.ChatCompletionNewParams) (openai.ChatCompletionNewParams, error) {
	const method = methodPrefix + "chat-completion-new"
	if !wc.rew.Load() {
		_ = wc.notify(rc, method, params)
		return params, nil
	}

	var result openai.ChatCompletionNewParams
	err := wc.call(rc, method, params, &result)
	if err == nil {
		return result, nil
	}
	if wc.isSkipError(err) {
		return params, nil
	}

	return result, err
}

func (wc *RPC) ChatCompletionChunk(rc *aiflow.RequestContext, chunk openai.ChatCompletionChunk) {
	const method = methodPrefix + "chat-completion-chunk"
	_ = wc.notify(rc, method, json.RawMessage(chunk.RawJSON()))
}

func (wc *RPC) ChatCompletionDone(rc *aiflow.RequestContext) {
	const method = methodPrefix + "chat-completion-done"
	_ = wc.notify(rc, method, nil)
}

func (wc *RPC) ChatCompletionError(rc *aiflow.RequestContext, err error) {
	const method = methodPrefix + "chat-completion-error"
	wc.notifyError(rc, err, method)
}

func (wc *RPC) ResponseNew(rc *aiflow.RequestContext, params responses.ResponseNewParams) (responses.ResponseNewParams, error) {
	const method = methodPrefix + "response-new"

	var result responses.ResponseNewParams
	err := wc.call(rc, method, params, &result)
	if err == nil {
		return result, nil
	}
	if wc.isSkipError(err) {
		return params, nil
	}

	return result, err
}

func (wc *RPC) ResponseChunk(rc *aiflow.RequestContext, chunk responses.ResponseStreamEventUnion) {
	const method = methodPrefix + "response-chunk"
	_ = wc.notify(rc, method, json.RawMessage(chunk.RawJSON()))
}

func (wc *RPC) ResponseDone(rc *aiflow.RequestContext) {
	const method = methodPrefix + "response-done"
	_ = wc.notify(rc, method, nil)
}

func (wc *RPC) ResponseError(rc *aiflow.RequestContext, err error) {
	const method = methodPrefix + "response-error"
	wc.notifyError(rc, err, method)
}

func (wc *RPC) notifyError(rc *aiflow.RequestContext, err error, method string) {
	params := new(jsonrpc2.Error)
	switch et := err.(type) {
	case *jsonrpc2.Error:
		params = et
	case *openai.Error:
		params.Code = int64(et.StatusCode)
		params.Message = et.Error()
		params.Data = new(json.RawMessage(et.RawJSON()))
	default:
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

func (wc *RPC) call(rc *aiflow.RequestContext, method string, params, result any) error {
	meta := wc.extractMetadata(rc)
	parent := rc.Request.Context()

	timeout := 10 * time.Second
	meta.TimeoutSeconds = int(timeout.Seconds())

	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()

	return wc.stm.Call(ctx, method, params, result, jsonrpc2.Meta(meta))
}

func (wc *RPC) extractMetadata(rc *aiflow.RequestContext) *Metadata {
	// 已知不会带 Session ID 的 Agent：
	// cline
	headers := []string{
		"X-Session-Id",       // opencode/kilo
		"X-Session-Affinity", // opencode/kilo
		"Agent-Session-Id",   // goose
		"X-Conversation-Id",  // Tencent Cloud CodeBuddy
		"session-id",         // codex
	}
	var sessionID string
	for _, key := range headers {
		sessionID = rc.Request.Header.Get(key)
		if sessionID != "" {
			break
		}
	}

	return &Metadata{
		ClientIP:  rc.ClientIP,
		SessionID: sessionID,
		RequestID: rc.RequestID,
		UserAgent: rc.Request.UserAgent(),
	}
}

func (wc *RPC) isSkipError(err error) bool {
	if err == nil {
		return true
	}
	if errors.Is(err, jsonrpc2.ErrClosed) {
		return true
	}
	if neterr, ok := err.(net.Error); ok {
		return neterr.Timeout()
	}

	return false
}
