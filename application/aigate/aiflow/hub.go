package aiflow

import (
	"slices"
	"sync"
)

type Huber interface {
	ChatCompletion() ChatCompletion
	AddChatCompletion(v ChatCompletion) bool
	DelChatCompletion(v ChatCompletion) bool
}

type flowHub struct {
	mutex           sync.RWMutex
	chatCompletions ChatCompletions
}

func NewHub() Huber {
	return &flowHub{}
}

func (fh *flowHub) ChatCompletion() ChatCompletion {
	return fh.newChatCompletionRefer()
}

func (fh *flowHub) AddChatCompletion(v ChatCompletion) bool {
	if v == nil {
		return false
	}

	fh.mutex.Lock()
	defer fh.mutex.Unlock()

	if slices.Contains(fh.chatCompletions, v) {
		return false
	}
	fh.chatCompletions = append(fh.chatCompletions, v)

	return true
}

func (fh *flowHub) DelChatCompletion(v ChatCompletion) bool {
	if v == nil {
		return false
	}

	fh.mutex.Lock()
	defer fh.mutex.Unlock()

	completions := make(ChatCompletions, 0, len(fh.chatCompletions))
	for _, ele := range fh.chatCompletions {
		if ele != v {
			completions = append(completions, ele)
		}
	}
	fh.chatCompletions = completions

	return true
}

func (fh *flowHub) loadChatCompletions() ChatCompletions {
	fh.mutex.RLock()
	defer fh.mutex.RUnlock()

	return slices.Clone(fh.chatCompletions)
}

func (fh *flowHub) newChatCompletionRefer() *chatCompletionRefer {
	return &chatCompletionRefer{hub: fh}
}
