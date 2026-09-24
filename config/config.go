package config

import (
	"io/fs"
	"os"
)

type Config struct {
	WebKey    string              `json:"web_key"`
	AIKeys    []string            `json:"ai_keys"`
	Server    Server              `json:"server"`
	OpenAI    OpenAI              `json:"openai"`
	Qdrant    Qdrant              `json:"qdrant"`
	MongoDB   MongoDB             `json:"mongodb"`
	Embedding Embedding           `json:"embedding"`
	Static    map[string][]Static `json:"static"`
}

type Server struct {
	Addr string `json:"addr"`
}

type OpenAI struct {
	BaseURL string `json:"base_url"`
	APIKey  string `json:"api_key"`
}

type Embedding struct {
	BaseURL string `json:"base_url"`
	APIKey  string `json:"api_key"`
	Model   string `json:"model"`
}

type MongoDB struct {
	URI string `json:"uri"`
}

type Qdrant struct {
	Host   string `json:"host"`
	Port   int    `json:"port"`
	UseTLS bool   `json:"use_tls"`
	APIKey string `json:"api_key"`
}

type Static struct {
	Path string `json:"path" validate:"required"`
	Slug string `json:"slug" validate:"required"`
	Name string `json:"name" validate:"required"`
	SPA  bool   `json:"spa"`
}

func (s Static) Open(name string) (fs.File, error) {
	const spaIndex = "index.html"

	dfs := os.DirFS(s.Path)
	if f, err := dfs.Open(name); err == nil ||
		name == spaIndex ||
		!s.SPA ||
		!os.IsNotExist(err) {
		return f, err
	}

	return dfs.Open(spaIndex)
}
