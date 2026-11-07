#!/usr/bin/env bash
# Playwright's WebKit is built on Ubuntu 24.04 and needs three libraries that other Linux
# distributions (Arch, Fedora...) do not ship under those versions: libicu74, libxml2 (2.9) and
# libflite1. Without root, this fetches Ubuntu's own packages, checks their SHA-256 against
# Ubuntu's signed-by-https package index, unpacks them and copies the libraries into the
# browser bundle's private `sys/lib`, which the bundle already puts on its library path.
#
#   pnpm exec playwright install webkit
#   bash tools/linux-webkit-libs.sh
#
# Then run with PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 (playwright.config.ts sets it on
# distributions other than Debian and Ubuntu). Re-run it after `playwright install` fetches a
# new WebKit. On Ubuntu, `playwright install --with-deps webkit` does all of this and this
# script is not needed.
set -euo pipefail

archive=https://archive.ubuntu.com/ubuntu
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cache="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"

for index in noble/main noble-updates/main noble/universe noble-updates/universe; do
  curl -fsS "$archive/dists/$index/binary-amd64/Packages.gz" -o "$work/$(echo "$index" | tr / -).gz"
done

fetch() {
  local pkg="$1" line file sha
  line="$(for f in "$work"/*.gz; do zcat "$f"; done | awk -v p="$pkg" '
    BEGIN { RS = ""; FS = "\n" }
    $1 == "Package: " p { f = ""; s = ""; v = ""
      for (i = 1; i <= NF; i++) { if ($i ~ /^Filename:/) f = substr($i, 11); if ($i ~ /^SHA256:/) s = substr($i, 9) }
      print f " " s }' | tail -n 1)"
  file="${line% *}"; sha="${line#* }"
  [ -n "$file" ] || { echo "package $pkg not found in the index" >&2; exit 1; }
  curl -fsS "$archive/$file" -o "$work/$pkg.deb"
  echo "$sha  $work/$pkg.deb" | sha256sum -c - >/dev/null || { echo "checksum mismatch for $pkg" >&2; exit 1; }
  mkdir -p "$work/x-$pkg" && (cd "$work/x-$pkg" && ar x "$work/$pkg.deb" && tar -xf data.tar.* -C "$work/root")
}

mkdir -p "$work/root" "$work/lib"
for pkg in libicu74 libxml2 libflite1; do fetch "$pkg"; done
find "$work/root" -name '*.so*' -exec cp -a {} "$work/lib/" \;

copied=0
for dir in "$cache"/webkit-*/minibrowser-*/sys/lib; do
  [ -d "$dir" ] || continue
  cp -a "$work/lib/." "$dir/"
  copied=$((copied + 1))
done
echo "libraries copied into $copied WebKit bundle folder(s) under $cache"
[ "$copied" -gt 0 ] || { echo "no WebKit bundle found: run 'pnpm exec playwright install webkit' first" >&2; exit 1; }
