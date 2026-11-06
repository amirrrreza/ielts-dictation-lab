#!/bin/zsh
set -eu
cd -- "${0:A:h}"
url=http://127.0.0.1:8765
data="$HOME/Library/Application Support/IELTS Dictation Lab"
runtime="$data/runtime"
export IELTS_MODEL_CACHE="$data/models"
if ! curl -fsS "$url/guided.js" | grep -q 'function groupWords'; then
  if curl -fsS "$url/" >/dev/null 2>&1; then
    echo 'Port 8765 is occupied. Close the other app using it and try again.'
    exit 1
  fi
  if [[ ! -x "$runtime/bin/python" ]]; then python3 -m venv "$runtime"; fi
  "$runtime/bin/python" -m pip install --disable-pip-version-check -r requirements.txt
  "$runtime/bin/python" guided_server.py &
  server=$!
  trap 'kill "$server" 2>/dev/null || true' EXIT
  for attempt in {1..100}; do
    if curl -fsS "$url/guided.js" >/dev/null 2>&1; then break; fi
    sleep .2
  done
  curl -fsS "$url/guided.js" >/dev/null
  open "$url/"
  wait "$server"
else
  open "$url/"
fi
