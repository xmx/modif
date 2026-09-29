package bininfo

import (
	"fmt"
	"io"
	"os"
	"os/user"
	"runtime"
	"runtime/debug"
	"strings"
	"sync"
	"time"
)

func ANSI(w io.Writer) (int, error) {
	inf := Get()
	return fmt.Fprintf(w, ansiText, inf.Module, inf.Version, inf.GOOS,
		inf.GOARCH, inf.Workdir, inf.CommittedAt, inf.Module, inf.Revision)
}

type Info struct {
	GOOS        string           `json:"goos"`                  // 操作系统
	GOARCH      string           `json:"goarch"`                // 架构
	Version     string           `json:"version"`               // 版本号
	Revision    string           `json:"revision"`              // 修订版本
	Username    string           `json:"username"`              // 用户名
	Workdir     string           `json:"workdir"`               // 工作目录
	Module      string           `json:"module"`                // 包路径
	CommittedAt time.Time        `json:"committed_at,omitzero"` // VCS 提交时间
	BuildInfo   *debug.BuildInfo `json:"build_info,omitzero"`   // BuildInfo
}

var buildInfoOnce = sync.OnceValue(buildInfo)

func Get() Info {
	return buildInfoOnce()
}

func buildInfo() Info {
	info := Info{
		GOOS:   runtime.GOOS,
		GOARCH: runtime.GOARCH,
	}
	info.Workdir, _ = os.Getwd()
	if cu, _ := user.Current(); cu != nil {
		info.Username = cu.Username
	}

	binfo, _ := debug.ReadBuildInfo()
	if binfo != nil {
		info.BuildInfo = binfo
		info.Module = binfo.Main.Path
		settings := binfo.Settings
		for _, set := range settings {
			key, val := set.Key, set.Value
			switch key {
			case "GOOS":
				info.GOOS = val
			case "GOARCH":
				info.GOARCH = val
			case "vcs.revision":
				info.Revision = val
			case "vcs.time":
				commitAt := parseTime(val)
				info.CommittedAt = commitAt
				info.Version = commitAt.UTC().Format("2006.1.2") // yyyy.MM.dd
			}
		}
		if info.Version == "" {
			sv := binfo.Main.Version
			info.Version = strings.TrimPrefix(sv, "v")
		}
	}

	if rv := info.Revision; rv != "" {
		if len(rv) > 7 {
			rv = rv[:7]
		}
		info.Version = info.Version + "+" + rv
	}

	return info
}

func parseTime(s string) time.Time {
	for _, layout := range []string{
		time.RFC1123Z, time.UnixDate, time.Layout, time.ANSIC,
		time.RubyDate, time.RFC822, time.RFC822Z, time.RFC850,
		time.RFC1123, time.RFC3339, time.RFC3339Nano, time.Kitchen,
		time.Stamp, time.StampMilli, time.StampMicro, time.StampNano,
		time.DateTime, time.DateOnly,
	} {
		if dt, err := time.Parse(layout, s); err == nil {
			if dt.IsZero() {
				return dt
			}

			return dt.Local()
		}
	}

	return time.Time{}
}

const ansiText = "\n\033[1;33m" +
	"\t+-+-+-+-+-+\n" +
	"\t|M|O|D|I|F|\n" +
	"\t+-+-+-+-+-+\n" +
	"\t\033[0;35m[%s]\033[0m \033[3;95mv%s\033[0m\n\n" +
	"\t\033[1;36m操作系统:\033[0m %s\n" +
	"\t\033[1;36m系统架构:\033[0m %s\n" +
	"\t\033[1;36m工作目录:\033[0m %s\n" +
	"\t\033[1;36m提交时间:\033[0m %s\n" +
	"\t\033[1;36m修订版本:\033[0m https://%s/tree/%s\n\n"
