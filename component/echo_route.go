package component

import (
	"github.com/NVIDIA/gontainer/v2"
	"github.com/xmx/modif/application/echox"
)

func EchoHTTPRegister(eg echox.EchoRoute, rts gontainer.Multiple[echox.HTTPRegister]) error {
	for _, rt := range rts {
		if err := rt.RegisterHTTP(eg); err != nil {
			return err
		}
	}

	return nil
}
