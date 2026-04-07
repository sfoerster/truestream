#!/usr/bin/env bash
set -euo pipefail

MANIFEST_URL="${MODEL_MANIFEST_URL:-https://models.truestream.app/manifest.json}"
OUTPUT_DIR="src/models/assets"

mkdir -p "$OUTPUT_DIR"

echo "Fetching model manifest from $MANIFEST_URL..."
MANIFEST=$(curl -sf "$MANIFEST_URL" 2>/dev/null || echo '{"models":[]}')

if [ "$MANIFEST" = '{"models":[]}' ]; then
  echo "Warning: Could not fetch manifest. Models must be downloaded manually."
  exit 0
fi

echo "$MANIFEST" | python3 -c "
import json, sys
manifest = json.load(sys.stdin)
for model in manifest.get('models', []):
    print(f\"{model['id']}|{model['version']}|{model['filename']}|{model['sha256']}|{model['sizeBytes']}\")
" | while IFS='|' read -r id version filename sha256 size; do
  filepath="$OUTPUT_DIR/$filename"
  echo ""
  echo "Downloading $id v$version ($size bytes)..."

  url="https://models.truestream.app/v${version}/${filename}"
  curl -sf -o "$filepath" "$url" || { echo "Failed to download $id"; continue; }

  actual_sha=$(sha256sum "$filepath" | cut -d' ' -f1)
  if [ "$actual_sha" = "$sha256" ]; then
    echo "  SHA-256 verified"
  else
    echo "  SHA-256 MISMATCH! Expected: $sha256, Got: $actual_sha"
    rm -f "$filepath"
  fi
done

echo ""
echo "Done. Models saved to $OUTPUT_DIR/"
ls -la "$OUTPUT_DIR/" 2>/dev/null || echo "(empty)"
