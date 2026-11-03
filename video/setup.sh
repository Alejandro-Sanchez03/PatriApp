#!/usr/bin/env bash
# Reinstala el estudio de vídeo (el contenedor de la nube es efímero).
set -e
cd "$(dirname "$0")"
pip3 install -q kokoro-onnx soundfile piper-tts moviepy pillow numpy pysubs2 pydub
npm install --silent
mkdir -p models/kokoro models/piper
K=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
for f in kokoro-v1.0.onnx voices-v1.0.bin; do [ -f models/kokoro/$f ] || curl -sSfL -o models/kokoro/$f $K/$f; done
P=https://github.com/rhasspy/piper/releases/download/v0.0.2
for v in es-carlfm-x-low es-mls_10246-low es-mls_9972-low; do
  [ -f models/piper/$v.onnx ] || curl -sSfL $P/voice-$v.tar.gz | tar xz -C models/piper
done
echo "Estudio listo."
