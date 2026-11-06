import json
import mimetypes
import os
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock

import av
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent
MODEL_CACHE = os.environ.get("IELTS_MODEL_CACHE")
model_lock = Lock()
models = {}
original_open = av.open

def compatible_open(*args, **kwargs):
    kwargs.pop("metadata_errors", None)
    return original_open(*args, **kwargs)

av.open = compatible_open

class Handler(BaseHTTPRequestHandler):
    def reply(self, status, body, kind="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        routes = {"/": ROOT / "web" / "index.html"}
        routes.update({f"/{name}": ROOT / "web" / name for name in ("words.js", "app.js", "guided.js")})
        path = routes.get(self.path)
        if path is None:
            self.reply(404, b"Not found", "text/plain")
        else:
            self.reply(200, path.read_bytes(), mimetypes.guess_type(path)[0])

    def do_POST(self):
        if self.headers.get("Origin") != f"http://127.0.0.1:{self.server.server_port}":
            self.reply(403, b"{}")
            return
        language = {"/transcribe/en": "en", "/transcribe/fa": "fa"}.get(self.path)
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not language or not 0 < length <= 200 * 1024**2:
            self.reply(400, b'{"error":"Choose an audio or video file under 200 MB."}')
            return
        try:
            with tempfile.TemporaryFile() as media:
                remaining = length
                while remaining:
                    block = self.rfile.read(min(remaining, 1024 * 1024))
                    if not block:
                        raise ValueError("Incomplete audio file")
                    media.write(block)
                    remaining -= len(block)
                media.seek(0)
                model_name = "base.en" if language == "en" else "base"
                with model_lock:
                    if model_name not in models:
                        models[model_name] = WhisperModel(model_name, device="cpu", compute_type="int8", download_root=MODEL_CACHE)
                    segments, _ = models[model_name].transcribe(media, language=language, word_timestamps=True)
                    words = [{"text": word.word, "start": word.start, "end": word.end}
                             for segment in segments for word in segment.words
                             if word.word.strip() and word.end > word.start]
            self.reply(200, json.dumps(words).encode())
        except Exception as error:
            print(error, flush=True)
            self.reply(422, b'{"error":"Could not transcribe this file. Check the model download and try again."}')

ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
