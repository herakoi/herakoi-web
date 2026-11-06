#!/usr/bin/env zsh
# Regenerates the PWA icons in public/ from public/favicon.svg.
# Requires rsvg-convert (brew install librsvg).
set -euo pipefail

cd "${0:A:h}/.."
src=public/favicon.svg
bg="#141110"
# The drawing without its rounded background and clip path.
rays=$(grep '<path' "$src")

# Full-bleed square with the drawing inset by `pad` units of the 32-unit grid.
square() {
  local pad=$1 size=$(( 32 + 2 * $1 ))
  print -r -- "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-$pad -$pad $size $size\">
<rect x=\"-$pad\" y=\"-$pad\" width=\"$size\" height=\"$size\" fill=\"$bg\"/>
$rays
</svg>"
}

rsvg-convert -w 192 -h 192 "$src" -o public/pwa-192x192.png
rsvg-convert -w 512 -h 512 "$src" -o public/pwa-512x512.png
# Maskable icons keep the drawing inside the central 80% safe zone.
square 4 | rsvg-convert -w 512 -h 512 -o public/pwa-maskable-512x512.png
# iOS rounds the corners itself and needs an opaque square.
square 2 | rsvg-convert -w 180 -h 180 -o public/apple-touch-icon.png
