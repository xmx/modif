package service

import (
	"github.com/NVIDIA/gontainer/v2"
	"github.com/xmx/modif/application/manager/response"
)

type Inject struct {
	opts []gontainer.Option
}

func NewInject(opts []gontainer.Option) *Inject {
	return &Inject{
		opts: opts,
	}
}

func (jet *Inject) Components() []response.InjectComponent {
	ret := make([]response.InjectComponent, 0, len(jet.opts))
	for _, opt := range jet.opts {
		switch v := opt.(type) {
		case *gontainer.Factory:
			ele := response.InjectComponent{Name: v.Name(), Source: v.Source()}
			ret = append(ret, ele)
		case *gontainer.Entrypoint:
			ele := response.InjectComponent{Name: v.Name(), Source: v.Source()}
			ret = append(ret, ele)
		}
	}

	return ret
}
