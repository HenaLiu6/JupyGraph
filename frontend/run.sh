#!/usr/bin/env bash

PORT=8080
URL="http://localhost:$PORT/jupygraph.html"

echo "Starting server at $URL"

# Copy to clipboard (macOS / Linux / Windows)
if command -v pbcopy >/dev/null 2>&1; then
  echo -n "$URL" | pbcopy
  echo "Copied to clipboard (pbcopy)"

elif command -v xclip >/dev/null 2>&1; then
  echo -n "$URL" | xclip -selection clipboard
  echo "Copied to clipboard (xclip)"

elif command -v wl-copy >/dev/null 2>&1; then
  echo -n "$URL" | wl-copy
  echo "Copied to clipboard (wl-copy)"

elif command -v clip.exe >/dev/null 2>&1; then
  echo -n "$URL" | clip.exe
  echo "Copied to clipboard (clip.exe)"

elif command -v powershell.exe >/dev/null 2>&1; then
  printf "%s" "$URL" | powershell.exe Set-Clipboard
  echo "Copied to clipboard (PowerShell)"

else
  echo "Clipboard tool not found"
fi


# Start server
python -m http.server "$PORT"