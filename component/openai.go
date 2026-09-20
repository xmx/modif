package component

import (
	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/xmx/modif/config"
)

func NewOpenAI(cfg config.OpenAI) openai.Client {
	return openai.NewClient(
		option.WithBaseURL(cfg.BaseURL),
		option.WithAPIKey(cfg.APIKey),
	)
}
