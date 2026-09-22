package config

import (
	"io/fs"
	"os"
)

type Config struct {
	Server Server              `json:"server"`
	OpenAI OpenAI              `json:"openai"`
	Static map[string][]Static `json:"static"`
}

type Server struct {
	Addr string `json:"addr"`
}

type OpenAI struct {
	BaseURL string `json:"base_url"`
	APIKey  string `json:"api_key"`
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
