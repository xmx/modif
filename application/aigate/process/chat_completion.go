package process

import (
	"log/slog"

	"github.com/labstack/echo/v5"
	"github.com/openai/openai-go/v3"
	"github.com/xmx/modif/application/aigate/aiflow"
	"github.com/xmx/modif/library/ssestream"
)

type ChatCompletion struct {
	cli openai.Client
	hub aiflow.Huber
	log *slog.Logger
}

func NewChatCompletion(cli openai.Client, hub aiflow.Huber, log *slog.Logger) *ChatCompletion {
	return &ChatCompletion{
		cli: cli,
		hub: hub,
		log: log,
	}
}

//goland:noinspection GoUnhandledErrorResult
func (cc *ChatCompletion) Completions(rc *aiflow.RequestContext, params openai.ChatCompletionNewParams) error {
	hook := cc.hub.ChatCompletion()
	msg, err := hook.ChatCompletionNew(rc, params)
	if err != nil {
		return err
	}

	sse, ok := ssestream.NewWriter(rc.Response)
	if !ok {
		return echo.ErrUnsupportedMediaType
	}

	ctx := rc.Request.Context()
	stm := cc.cli.Chat.Completions.NewStreaming(ctx, msg)
	if err = stm.Err(); err != nil {
		hook.ChatCompletionError(rc, err)
		return err
	}
	defer stm.Close()

	var wrote bool
	var chunk openai.ChatCompletionChunk
	for stm.Next() {
		chunk = stm.Current()
		if err = sse.Text(chunk.RawJSON()); err != nil {
			cc.log.Error("回写事件流出错", "err", err)
			if wrote {
				return nil
			}

			return err
		}

		wrote = true
		hook.ChatCompletionChunk(rc, chunk)
	}
	if err = stm.Err(); err != nil {
		hook.ChatCompletionError(rc, err)
		if wrote {
			return nil
		}

		return err
	}
	_ = sse.Done()

	hook.ChatCompletionUsage(rc, chunk.Usage)
	hook.ChatCompletionDone(rc)

	return nil
}
