package jsonrpc

import (
	"context"

	"github.com/sourcegraph/jsonrpc2"
)

type Validator interface {
	Validate(v any) error
}

type RPCMux struct {
	Validator      Validator
	MethodNotFound RPCHandlerFunc
	ErrorHandler   func(rc *RPCContext, err error)
	methods        map[string]RPCHandlerFunc
}

func NewMux() *RPCMux {
	return &RPCMux{}
}

func (mux *RPCMux) HandleFunc(method string, fun RPCHandlerFunc) {
	if mux.methods == nil {
		mux.methods = make(map[string]RPCHandlerFunc, 8)
	}

	mux.methods[method] = fun
}

func (mux *RPCMux) Handle(ctx context.Context, conn *jsonrpc2.Conn, req *jsonrpc2.Request) {
	rc := &RPCContext{ctx: ctx, conn: conn, req: req, mux: mux}
	fun := mux.methods[req.Method]
	if fun == nil {
		_ = mux.methodNotFound(rc)
		return
	}

	err := fun(rc)
	if req.Notif || rc.Replied() {
		return
	}

	if err != nil {
		if h := mux.ErrorHandler; h != nil {
			h(rc, err)
		} else {
			_ = rc.ReplyWithError(err)
		}
	} else {
		_ = rc.Reply(nil)
	}
}

func (mux *RPCMux) methodNotFound(rc *RPCContext) error {
	if f := mux.MethodNotFound; f != nil {
		return f(rc)
	}
	msg := &jsonrpc2.Error{Code: jsonrpc2.CodeMethodNotFound, Message: "该方法不存在或无效"}

	return rc.ReplyWithError(msg)
}

type MethodRegister interface {
	RegisterMethod(mux *RPCMux)
}

type MethodRegisters []MethodRegister

func (mr MethodRegisters) RegisterMethod(mux *RPCMux) {
	for _, m := range mr {
		m.RegisterMethod(mux)
	}
}
