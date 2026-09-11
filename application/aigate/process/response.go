package process

import (
	"context"
	"errors"
	"log/slog"

	"github.com/labstack/echo/v5"
	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/responses"
	"github.com/xmx/modif/application/aigate/aiflow"
	"github.com/xmx/modif/library/ssestream"
)

type Response struct {
	cli openai.Client
	hub aiflow.Huber
	log *slog.Logger
}

func NewResponse(cli openai.Client, hub aiflow.Huber, log *slog.Logger) *Response {
	return &Response{
		cli: cli,
		hub: hub,
		log: log,
	}
}

func (rsp *Response) Responses(rc *aiflow.RequestContext, params responses.ResponseNewParams) error {
	hook := rsp.hub.RefResponse()
	msg, err := hook.ResponseNew(rc, params)
	if err != nil {
		return err
	}

	ctx := rc.Request.Context()
	stm := rsp.cli.Responses.NewStreaming(ctx, msg)
	if err = stm.Err(); err != nil {
		rsp.log.Error("请求上游模型出错", "err", err)
		hook.ResponseError(rc, err)
		return err
	}

	sse, ok := ssestream.NewWriter(rc.Response)
	if !ok {
		return echo.ErrUnsupportedMediaType
	}

	for stm.Next() {
		event := stm.Current()

		// 1. 先写事件类型（末尾是单换行 \n，不会提前关闭块）
		if err = sse.Event(event.Type); err != nil {
			rsp.log.Error("回写事件类型出错", "err", err)
			return err
		}

		// 2. 再写事件数据（末尾是双换行 \n\n，正式完成该事件块的推送）
		if err = sse.Text(event.RawJSON()); err != nil {
			rsp.log.Error("回写事件数据出错", "err", err)
			return err
		}

		hook.ResponseChunk(rc, event)
	}

	if err = stm.Err(); err != nil && !errors.Is(err, context.Canceled) {
		rsp.log.Error("读取事件流出错", "err", err)
		hook.ResponseError(rc, err)
		return err
	}

	// 3. 结束推送
	_ = sse.Done()
	hook.ResponseDone(rc)

	return nil
}
