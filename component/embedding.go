package component

import (
	"context"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/openai/openai-go/v3/packages/param"
	"github.com/xmx/modif/config"
)

type Embedding interface {
	Embedding(ctx context.Context, input string) ([]float32, error)
}

func NewEmbedding(cfg config.Embedding) Embedding {
	cli := openai.NewClient(
		option.WithBaseURL(cfg.BaseURL),
		option.WithAPIKey(string(cfg.APIKey)),
	)

	return &llmEmbedding{
		cli:   cli,
		model: cfg.Model,
	}
}

type llmEmbedding struct {
	cli   openai.Client
	model string
}

func (ebd *llmEmbedding) Embedding(ctx context.Context, input string) ([]float32, error) {
	params := openai.EmbeddingNewParams{
		Input: openai.EmbeddingNewParamsInputUnion{
			OfString: param.Opt[string]{
				Value: input,
			},
		},
		Model: ebd.model,
	}
	res, err := ebd.cli.Embeddings.New(ctx, params)
	if err != nil {
		return nil, err
	}

	f64s := res.Data[0].Embedding
	f32s := make([]float32, len(f64s))
	for i, f64 := range f64s {
		f32s[i] = float32(f64)
	}

	return f32s, nil
}
