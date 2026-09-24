package wsocket

const methodPrefix = "modif/"

type Metadata struct {
	ClientIP  string `json:"client_ip"`
	RequestID string `json:"request_id"`
	SessionID string `json:"session_id,omitzero"`
	ThreadID  string `json:"thread_id,omitzero"`
}
