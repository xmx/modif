package aiflow

import (
	"slices"
	"sync"
)

type Huber interface {
	AllChatCompletion() []ChatCompletion
	RefChatCompletion() ChatCompletion
	AddChatCompletion(v ChatCompletion)
	DelChatCompletion(v ChatCompletion)

	AllResponse() []Response
	RefResponse() Response
	AddResponse(v Response)
	DelResponse(v Response)
}

type flowHub struct {
	mutex           sync.RWMutex
	chatCompletions *hookerList[ChatCompletion]
	responses       *hookerList[Response]
}

func NewHub() Huber {
	return &flowHub{
		chatCompletions: new(hookerList[ChatCompletion]),
		responses:       new(hookerList[Response]),
	}
}

func (fh *flowHub) AllChatCompletion() []ChatCompletion {
	return fh.chatCompletions.Hooks()
}

func (fh *flowHub) RefChatCompletion() ChatCompletion {
	return &hubRefer{hub: fh}
}

func (fh *flowHub) AddChatCompletion(v ChatCompletion) {
	if v != nil {
		fh.chatCompletions.Add(v)
	}
}

func (fh *flowHub) DelChatCompletion(v ChatCompletion) {
	if v != nil {
		fh.chatCompletions.Del(v)
	}
}

func (fh *flowHub) AllResponse() []Response {
	return fh.responses.Hooks()
}

func (fh *flowHub) RefResponse() Response {
	return &hubRefer{hub: fh}
}

func (fh *flowHub) AddResponse(v Response) {
	if v != nil {
		fh.responses.Add(v)
	}
}

func (fh *flowHub) DelResponse(v Response) {
	if v != nil {
		fh.responses.Del(v)
	}
}

type hookerList[T comparable] struct {
	mutex sync.RWMutex
	hooks []T
}

func (hkl *hookerList[T]) Hooks() []T {
	hkl.mutex.RLock()
	defer hkl.mutex.RUnlock()

	return slices.Clone(hkl.hooks)
}

func (hkl *hookerList[T]) Add(v T) {
	hkl.mutex.Lock()
	defer hkl.mutex.Unlock()

	if !slices.Contains(hkl.hooks, v) {
		hkl.hooks = append(hkl.hooks, v)
	}
}

func (hkl *hookerList[T]) Del(v T) {
	hkl.mutex.Lock()
	defer hkl.mutex.Unlock()

	hooks := make([]T, 0, len(hkl.hooks))
	for _, hook := range hkl.hooks {
		if v != hook {
			hooks = append(hooks, hook)
		}
	}
	hkl.hooks = hooks
}
