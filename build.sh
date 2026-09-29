#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

readonly BASE_NAME="modif"

GIT_SHORT_SHA=$(git rev-parse --short=7 HEAD)
GIT_COMMIT_EPOCH=$(git log -1 --format=%ct)
TIME_VERSION=$(date -u -d "@${GIT_COMMIT_EPOCH}" +'%Y.%-m.%-d')
[[ -n "${TIME_VERSION}" ]] || { echo "无法解析版本号" >&2; exit 1; }
VERSION="v${TIME_VERSION}+${GIT_SHORT_SHA}"

GO_GOOS=$(go env GOOS)
GO_GOARCH=$(go env GOARCH)
GO_GOEXE=$(go env GOEXE)
BINARY_NAME="${BASE_NAME}-${GO_GOOS}-${GO_GOARCH}@${VERSION}${GO_GOEXE}"

go build \
  -v \
  -o "${BINARY_NAME}" \
  -tags=osusergo,netgo \
  -trimpath \
  -ldflags "-s -w" \
  ./main

BINARY_MD5=$(md5sum "${BINARY_NAME}" | awk '{print $1}')
BINARY_SHA1=$(sha1sum "${BINARY_NAME}" | awk '{print $1}')
BINARY_SHA256=$(sha256sum "${BINARY_NAME}" | awk '{print $1}')
cat <<EOF > VERSION
BINARY_FILE_NAME: ${BINARY_NAME}
BINARY_FILE_MD5: ${BINARY_MD5}
BINARY_FILE_SHA1: ${BINARY_SHA1}
BINARY_FILE_SHA256: ${BINARY_SHA256}
VERSION: ${VERSION}
GO_VERSION: $(go version)
GIT_VERSION: $(git version)
COMPILE_TIME: $(date -u)
EOF

echo "编译产物：${BINARY_NAME}"