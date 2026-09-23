package echox

import (
	"context"
	"net/http"
	"reflect"

	"github.com/NVIDIA/gontainer/v2"
	"github.com/google/jsonschema-go/jsonschema"
	"github.com/labstack/echo/v5"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type MCPRegister interface {
	RegisterMCP(MCPServer) error
}

type MCPServer struct {
	srv   *mcp.Server    // MCP Server
	valid echo.Validator // 参数校验
	opts  *jsonschema.ForOptions
}

func NewMCPServer(srv *mcp.Server, valid echo.Validator, opts *jsonschema.ForOptions) MCPServer {
	return MCPServer{srv: srv, valid: valid, opts: opts}
}

func (ms MCPServer) Registers(mrs gontainer.Multiple[MCPRegister]) error {
	for _, mr := range mrs {
		if err := mr.RegisterMCP(ms); err != nil {
			return err
		}
	}

	return nil
}

func (ms MCPServer) StreamableHTTPHandler(opts *mcp.StreamableHTTPOptions) *mcp.StreamableHTTPHandler {
	return mcp.NewStreamableHTTPHandler(ms.getServer, opts)
}

func (ms MCPServer) AddTool[In, Out any](t *mcp.Tool, h mcp.ToolHandlerFor[In, Out]) error {
	if ms.opts != nil &&
		(ms.opts.IgnoreInvalidTypes || len(ms.opts.TypeSchemas) != 0) {
		if t.InputSchema == nil {
			schema, err := ms.forType[In]()
			if err != nil {
				return err
			}
			t.InputSchema = schema
		}
		if t.OutputSchema == nil {
			schema, err := ms.forType[Out]()
			if err != nil {
				return err
			}
			t.OutputSchema = schema
		}
	}

	vf := ms.newValidRequestHandler(h)
	mcp.AddTool[In, Out](ms.srv, t, vf)

	return nil
}

func (ms MCPServer) newValidRequestHandler[In, Out any](next mcp.ToolHandlerFor[In, Out]) mcp.ToolHandlerFor[In, Out] {
	return func(ctx context.Context, req *mcp.CallToolRequest, in In) (*mcp.CallToolResult, Out, error) {
		if ms.valid != nil {
			if err := ms.valid.Validate(req); err != nil {
				var out Out
				return nil, out, err
			}
		}

		return next(ctx, req, in)
	}
}

func (ms MCPServer) forType[T any]() (*jsonschema.Schema, error) {
	rt := reflect.TypeFor[T]()
	if rt.Kind() == reflect.Pointer {
		rt = rt.Elem()
	}

	return jsonschema.For[T](ms.opts)
}

func (ms MCPServer) getServer(*http.Request) *mcp.Server {
	return ms.srv
}
