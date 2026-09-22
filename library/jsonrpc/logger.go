package jsonrpc

import (
	"fmt"
	"log/slog"
	"strings"

	"github.com/sourcegraph/jsonrpc2"
)

func NewLogger(log *slog.Logger) jsonrpc2.Logger {
	return &logger{log: log}
}

type logger struct {
	log *slog.Logger
}

func (l *logger) Printf(format string, v ...any) {
	msg := fmt.Sprintf(format, v...)
	l.log.Info(strings.TrimSuffix(msg, "\n"))
}
