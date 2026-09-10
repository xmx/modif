package jsonrpc

import (
	"context"
	"encoding/json"

	"github.com/sourcegraph/jsonrpc2"
)

type RPCContext struct {
	ctx   context.Context
	conn  *jsonrpc2.Conn
	req   *jsonrpc2.Request
	mux   *RPCMux
	reply bool
}

func (rc *RPCContext) Context() context.Context {
	return rc.ctx
}

func (rc *RPCContext) Request() *jsonrpc2.Request {
	return rc.req
}

func (rc *RPCContext) Replied() bool {
	return rc.reply
}

func (rc *RPCContext) Bind(v any) error {
	params := rc.req.Params
	if params == nil {
		return nil
	}

	if err := json.Unmarshal(*params, v); err != nil {
		return err
	}
	if valid := rc.mux.Validator; valid != nil {
		return valid.Validate(v)
	}

	return nil
}

func (rc *RPCContext) Reply(result any) error {
	if rc.req.Notif || rc.Replied() {
		return nil
	}
	rc.reply = true

	return rc.conn.Reply(rc.ctx, rc.req.ID, result)
}

func (rc *RPCContext) ReplyWithError(err error) error {
	if rc.req.Notif || rc.Replied() {
		return nil
	}

	msg := new(jsonrpc2.Error)
	switch e := err.(type) {
	case *jsonrpc2.Error:
		msg = e
	default:
		msg.Code = jsonrpc2.CodeInternalError
		msg.Message = e.Error()
	}
	rc.reply = true

	return rc.conn.ReplyWithError(rc.ctx, rc.req.ID, msg)
}

type RPCHandlerFunc func(rc *RPCContext) error

type RPCMiddlewareFunc func(RPCHandlerFunc) RPCHandlerFunc
