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

	return w.writeData(tmp)
}

func (w *SSEWriter) Text(v string) error {
	return w.writeData(strings.NewReader(v))
}

func (w *SSEWriter) Done() error {
	return w.writeData(strings.NewReader("[DONE]"))
}

func (w *SSEWriter) Event(evt string) error {
	if _, err := io.WriteString(w.w, "event: "+evt+"\n"); err != nil {
		return err
	}
	w.f.Flush()

	return nil
}

func (w *SSEWriter) writeData(r io.Reader) error {
	defer w.f.Flush()

	var wrote bool
	br := bufio.NewReader(r)
	tmp := bytes.NewBufferString("data:")

	for {
		line, pre, err := br.ReadLine()
		if err != nil {
			if err == io.EOF {
				break
			}
			return err
		}

		tmp.Write(line)
		if pre {
			continue
		}

		tmp.WriteByte('\n')
		if _, err = tmp.WriteTo(w.w); err != nil {
			return err
		}

		tmp.Reset()
		tmp.WriteString("data: ")
		wrote = true
	}

	if wrote {
		_, err := w.w.Write([]byte("\n"))
		return err
	}

	return nil
}
