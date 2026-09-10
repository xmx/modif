package wsocket

const methodPrefix = "modif/"

type Metadata struct {
	RequestID      string `json:"request_id"`
	SessionID      string `json:"session_id,omitzero"`
	ThreadID       string `json:"thread_id,omitzero"`
	UserAgent      string `json:"user_agent,omitzero"`
	TimeoutSeconds int    `json:"timeout_seconds,omitzero"`
}
