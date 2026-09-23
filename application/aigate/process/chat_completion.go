package process

import (
	"context"
	"fmt"
	"log/slog"
	"slices"
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

	msg = cc.injectSystemPrompt(rc, msg)

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

	hook.ChatCompletionDone(rc)

	return nil
}

func (cc *ChatCompletion) injectSystemPrompt(rc *aiflow.RequestContext, msg openai.ChatCompletionNewParams) openai.ChatCompletionNewParams {
	messages := msg.Messages
	if len(messages) == 0 {
		return msg
	}

	last := messages[len(messages)-1]
	lastRole := last.GetRole()
	if lastRole == nil || *lastRole != "user" || last.OfUser == nil {
		return msg
	}

	// 只有纯字符串 content 才检索；多模态/内容块数组时 OfString 为空，跳过并用空串去 embedding
	if !last.OfUser.Content.OfString.Valid() {
		return msg
	}

	knowledge, err := cc.topK(rc.Request.Context(), last.OfUser.Content.OfString.Value)
	if err != nil {
		// 检索失败不中断对话，降级为“不注入”
		cc.log.Error("注入知识库失败", "err", err)
		return msg
	}
	if knowledge == "" {
		return msg
	}

	// 新增一条独立 system 消息：紧跟第一条 system 之后（index 1）；
	// 如果第一条不是 system，就放到最前（index 0）。
	kb := openai.SystemMessage(knowledge)
	insertAt := 1
	if firstRole := messages[0].GetRole(); firstRole == nil || *firstRole != "system" {
		insertAt = 0
	}
	msg.Messages = slices.Insert(msg.Messages, insertAt, kb)

	return msg
}

// 注入给模型的“使用说明”，告诉它知识从哪来、怎么用
const knowledgeInstruction = "以下是系统检索到的参考资料（带序号，越靠前相关性越高），仅供回答当前问题时参考。" +
	"请优先依据这些资料回答，必要时注明引用序号（如 [1]）；与问题无关的资料请忽略；若资料不足以回答，请明确说明，不要编造。"

func (cc *ChatCompletion) topK(ctx context.Context, input string) (string, error) {
	f32s, err := cc.ebd.Embedding(ctx, input)
	if err != nil {
		return "", err
	}

	qry := &qdrant.QueryPoints{
		CollectionName: "ssoc",
		Query:          qdrant.NewQuery(f32s...),
		Limit:          new(uint64(5)),
		ScoreThreshold: new(float32(0.5)),
		WithPayload:    qdrant.NewWithPayload(true),
	}
	result, err := cc.qdr.Query(ctx, qry)
	if err != nil {
		return "", err
	}

	knowledge := new(strings.Builder)
	knowledge.WriteString("\n\n<knowledge>\n")
	knowledge.WriteString(knowledgeInstruction)

	no := 0
	var wrote bool
	for _, point := range result {
		if point.Payload == nil {
			continue
		}

		content, ok := point.Payload["content"]
		if !ok {
			continue
		}

		text := content.GetStringValue()
		if text == "" { // 顺带修掉非字符串 payload 返回空串的问题
			continue
		}

		no++
		fmt.Fprintf(knowledge, "\n[%d] %s\n", no, text)
		wrote = true
	}
	if !wrote {
		return "", nil
	}
	knowledge.WriteString("</knowledge>")

	return knowledge.String(), nil
}
