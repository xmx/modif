package process

import (
	"context"
	"log/slog"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/pagination"
	"github.com/qdrant/go-client/qdrant"
	"github.com/xmx/modif/application/aigate/aiflow"
	"github.com/xmx/modif/component"
	"github.com/xmx/modif/library/ssestream"
)

type ChatCompletion struct {
	cli openai.Client
	ebd component.Embedding
	qdr *qdrant.Client
	hub aiflow.Huber
	log *slog.Logger
}

func NewChatCompletion(cli openai.Client, ebd component.Embedding, qdr *qdrant.Client, hub aiflow.Huber, log *slog.Logger) *ChatCompletion {
	return &ChatCompletion{
		cli: cli,
		ebd: ebd,
		qdr: qdr,
		hub: hub,
		log: log,
	}
}

func (cc *ChatCompletion) Models(ctx context.Context) (*pagination.Page[openai.Model], error) {
	return cc.cli.Models.List(ctx)
}

//goland:noinspection GoUnhandledErrorResult
func (cc *ChatCompletion) Completions(rc *aiflow.RequestContext, params openai.ChatCompletionNewParams) error {
	hook := cc.hub.RefChatCompletion()
	msg, err := hook.ChatCompletionNew(rc, params)
	if err != nil {
		return err
	}

	sse, ok := ssestream.NewWriter(rc.Response)
	if !ok {
		return echo.ErrUnsupportedMediaType
	}

	ctx := rc.Request.Context()
	messages := params.Messages
	num := len(messages)
	last := messages[num-1]
	if lastRole := last.GetRole(); lastRole != nil && *lastRole == "user" {
		knowledge, _ := cc.topK(ctx, last.OfUser.Content.OfString.Value)
		if knowledge != "" {
			first := messages[0]
			role := first.GetRole()
			if role != nil && *role == "system" {
				value := first.OfSystem.Content.OfString.Value
				first.OfSystem.Content.OfString.Value = value + knowledge
				params.Messages[0] = first
			}
		}
	}

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

	hook.ChatCompletionDone(rc)

	return nil
}

func (cc *ChatCompletion) topK(ctx context.Context, input string) (string, error) {
	f32s, err := cc.ebd.Embedding(ctx, input)
	if err != nil {
		return "", err
	}

	qry := &qdrant.QueryPoints{
		CollectionName: "ssoc",
		Query:          qdrant.NewQuery(f32s...),
		Limit:          new(uint64(5)),
		WithPayload:    qdrant.NewWithPayload(true),
	}
	result, err := cc.qdr.Query(ctx, qry)
	if err != nil {
		return "", err
	}

	knowledge := new(strings.Builder)
	knowledge.WriteString("\n\n<knowledge>")
	var wrote bool
	for _, point := range result {
		if point.Payload == nil {
			continue
		}

		content, ok := point.Payload["content"]
		if !ok {
			continue
		}

		knowledge.WriteString(content.GetStringValue())
		knowledge.WriteString("\n\n")
		wrote = true
	}
	if !wrote {
		return "", nil
	}
	knowledge.WriteString("</knowledge>")

	return knowledge.String(), nil
}
