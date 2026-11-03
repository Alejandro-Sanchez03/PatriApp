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
# Voces Piper de más calidad y Whisper (transcripción), alojados en GitHub por sherpa-onnx
T=https://github.com/k2-fsa/sherpa-onnx/releases/download
pip3 install -q sherpa-onnx
for n in es_ES-davefx-medium es_ES-sharvard-medium es_MX-claude-high es_AR-daniela-high es_MX-ald-medium; do
  [ -f models/piper/$n.onnx ] || { curl -sSfL $T/tts-models/vits-piper-$n.tar.bz2 | tar xj -C /tmp && cp /tmp/vits-piper-$n/$n.onnx* models/piper/; }
done
[ -d models/whisper-small ] || { curl -sSfL $T/asr-models/sherpa-onnx-whisper-small.tar.bz2 | tar xj -C /tmp && mkdir -p models/whisper-small && cp /tmp/sherpa-onnx-whisper-small/small-*int8.onnx /tmp/sherpa-onnx-whisper-small/small-tokens.txt models/whisper-small/; }
echo "Voces y Whisper listos."
