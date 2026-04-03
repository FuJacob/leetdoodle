#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(CDPATH='' cd -- "${SCRIPT_DIR}/.." && pwd)"
SERVICES_DIR="${REPO_ROOT}/services"
TEMPLATE_DIR="${REPO_ROOT}/infra/bundle/hobby-v1"
ARTIFACTS_DIR="${REPO_ROOT}/.artifacts"
BUNDLE_DIR="${ARTIFACTS_DIR}/leetdoodle-hobby-bundle-amd64"
BUNDLE_ARCHIVE="${ARTIFACTS_DIR}/leetdoodle-hobby-bundle-amd64.tar.gz"
IMAGES_DIR="${BUNDLE_DIR}/images"
IMAGES_TAR="${IMAGES_DIR}/leetdoodle-app-images-amd64.tar"
IMAGE_TAG="hobby-amd64"
TARGET_PLATFORM="linux/amd64"

require_file() {
  local path="$1"
  if [[ ! -f "${path}" ]]; then
    echo "Required file not found: ${path}" >&2
    exit 1
  fi
}

build_service_image() {
  local service_name="$1"
  local module="$2"
  local artifact="$3"
  local image_ref="$4"

  echo "Building ${image_ref} for ${TARGET_PLATFORM}..."
  docker buildx build \
    --platform "${TARGET_PLATFORM}" \
    --load \
    --tag "${image_ref}" \
    --build-arg "SERVICE_MODULE=${module}" \
    --build-arg "SERVICE_ARTIFACT=${artifact}" \
    --file "${SERVICES_DIR}/Dockerfile.service" \
    "${SERVICES_DIR}"

  local actual_platform
  actual_platform="$(docker image inspect "${image_ref}" --format '{{.Os}}/{{.Architecture}}')"
  if [[ "${actual_platform}" != "${TARGET_PLATFORM}" ]]; then
    echo "Image ${image_ref} has platform ${actual_platform}, expected ${TARGET_PLATFORM}." >&2
    exit 1
  fi
}

copy_bundle_template() {
  rm -rf "${BUNDLE_DIR}"
  mkdir -p "${IMAGES_DIR}" "${BUNDLE_DIR}/leetcode/seed"

  cp "${TEMPLATE_DIR}/docker-compose.yml" "${BUNDLE_DIR}/docker-compose.yml"
  cp "${TEMPLATE_DIR}/up.sh" "${BUNDLE_DIR}/up.sh"
  chmod +x "${BUNDLE_DIR}/up.sh"

  cp "${REPO_ROOT}/services/leetcode/data/seed/official-questions.json" \
    "${BUNDLE_DIR}/leetcode/seed/official-questions.json"
  cp "${REPO_ROOT}/services/leetcode/data/seed/test-cases.jsonl" \
    "${BUNDLE_DIR}/leetcode/seed/test-cases.jsonl"
}

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but not installed." >&2
  exit 1
fi

docker info >/dev/null
docker buildx version >/dev/null

require_file "${SERVICES_DIR}/Dockerfile.service"
require_file "${TEMPLATE_DIR}/docker-compose.yml"
require_file "${TEMPLATE_DIR}/up.sh"
require_file "${REPO_ROOT}/services/leetcode/data/seed/official-questions.json"
require_file "${REPO_ROOT}/services/leetcode/data/seed/test-cases.jsonl"

mkdir -p "${ARTIFACTS_DIR}"

build_service_image "collab" "collab" "collab-0.0.1-SNAPSHOT.jar" "leetdoodle/collab:${IMAGE_TAG}"
build_service_image "leetcode" "leetcode" "leetcode-service-0.0.1-SNAPSHOT.jar" "leetdoodle/leetcode:${IMAGE_TAG}"
build_service_image "submissions" "submissions" "submissions-0.0.1-SNAPSHOT.jar" "leetdoodle/submissions:${IMAGE_TAG}"
build_service_image "worker" "worker" "worker-0.0.1-SNAPSHOT.jar" "leetdoodle/worker:${IMAGE_TAG}"

copy_bundle_template

echo "Exporting app images to ${IMAGES_TAR}..."
docker save \
  --output "${IMAGES_TAR}" \
  "leetdoodle/collab:${IMAGE_TAG}" \
  "leetdoodle/leetcode:${IMAGE_TAG}" \
  "leetdoodle/submissions:${IMAGE_TAG}" \
  "leetdoodle/worker:${IMAGE_TAG}"

rm -f "${BUNDLE_ARCHIVE}"
tar -czf "${BUNDLE_ARCHIVE}" -C "${ARTIFACTS_DIR}" "$(basename "${BUNDLE_DIR}")"

cat <<EOF

Bundle created successfully.

Exploded bundle:
${BUNDLE_DIR}

Compressed archive:
${BUNDLE_ARCHIVE}

Friend workflow:
1. Copy the archive to the target VPS.
2. Extract it.
3. Run ./up.sh from the extracted bundle directory.
EOF
