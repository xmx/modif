package ssestream

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

type SSEWriter struct {
	w http.ResponseWriter
	f http.Flusher
}

func NewWriter(w http.ResponseWriter) (*SSEWriter, bool) {
	f, ok := w.(http.Flusher)
	if !ok {
		return nil, false
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	return &SSEWriter{w: w, f: f}, true
}

func (w *SSEWriter) JSON(v any) error {
	tmp := new(bytes.Buffer)
	if err := json.NewEncoder(tmp).Encode(v); err != nil {
		return err
	}

	return w.write(tmp)
}

func (w *SSEWriter) Text(v string) error {
	return w.write(strings.NewReader(v))
}

func (w *SSEWriter) Done() error {
	return w.write(strings.NewReader("[DONE]"))
}

func (w *SSEWriter) write(r io.Reader) error {
	defer w.f.Flush()

	br := bufio.NewReader(r)
	for {
		line, _, err := br.ReadLine()
		if err != nil {
			if err == io.EOF {
				return nil
			}

			return err
		}

		if _, err = io.WriteString(w.w, "data: "); err == nil {
			if _, err = w.w.Write(line); err == nil {
				_, err = w.w.Write([]byte{'\n', '\n'})
			}
		}

		if err != nil {
			return err
		}
	}
}
