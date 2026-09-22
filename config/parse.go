package config

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
)

// JSONC 方式读取配置文件，由于这种方式不是流式读取，为了防止误读大文件
// 导致 OOM，可以选择一个合适的值限制最大读取量。
func JSONC(filename string, maxsize ...int64) (*Config, error) {
	f, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var lr io.Reader = f
	if len(maxsize) > 0 && maxsize[0] > 0 {
		lr = io.LimitReader(lr, maxsize[0])
	}

	raw, err := io.ReadAll(lr)
	if err != nil {
		return nil, err
	}

	bs := toJSON(raw, nil)
	cfg := new(Config)
	dec := json.NewDecoder(bytes.NewReader(bs))
	dec.DisallowUnknownFields() // 严格模式
	if err = dec.Decode(cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}
