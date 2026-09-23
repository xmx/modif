package request

type Data[T any] struct {
	Data T `json:"data"`
}

func NewData[T any](t T) Data[T] {
	return Data[T]{Data: t}
}
