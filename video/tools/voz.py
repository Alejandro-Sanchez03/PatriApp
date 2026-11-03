#!/usr/bin/env python3
"""Guion JSON -> voz (Kokoro, offline) + tiempos de subtítulos + props para Remotion.

Uso:  python3 tools/voz.py guiones/demo.json
Salida en public/<id>/: voz.wav, subs.srt, props.json
"""
import json, re, sys
from pathlib import Path

import numpy as np
import soundfile as sf

RAIZ = Path(__file__).resolve().parent.parent
MODELOS = RAIZ / "models"
PAUSA = 0.35  # segundos de silencio entre frases


def sintetizar(texto, voz, velocidad):
    if voz.startswith("piper:"):
        from piper import PiperVoice
        v = PiperVoice.load(str(MODELOS / "piper" / f"{voz[6:]}.onnx"))
        audio = np.concatenate([c.audio_float_array for c in v.synthesize(texto)])
        return audio, v.config.sample_rate
    from kokoro_onnx import Kokoro
    global _kokoro
    if "_kokoro" not in globals():
        _kokoro = Kokoro(str(MODELOS / "kokoro/kokoro-v1.0.onnx"), str(MODELOS / "kokoro/voices-v1.0.bin"))
    return _kokoro.create(texto, voice=voz, speed=velocidad, lang="es")


def palabras_con_tiempo(texto, ini, fin):
    """Reparte el tiempo de la frase entre palabras según su longitud (aprox.)."""
    pals = texto.split()
    pesos = [len(re.sub(r"\W", "", p)) + 2 for p in pals]
    total, t, out = sum(pesos), ini, []
    for p, w in zip(pals, pesos):
        d = (fin - ini) * w / total
        out.append({"w": p, "s": round(t, 3), "e": round(t + d, 3)})
        t += d
    return out


def srt_t(s):
    ms = int(round(s * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


def main(ruta):
    g = json.loads(Path(ruta).read_text(encoding="utf-8"))
    voz, vel = g.get("voz", "ef_dora"), g.get("velocidad", 1.0)
    dest = RAIZ / "public" / g["id"]
    dest.mkdir(parents=True, exist_ok=True)

    trozos, frases, t, sr = [], [], 0.0, 24000
    for i, linea in enumerate(g["frases"]):
        texto = linea if isinstance(linea, str) else linea["texto"]
        audio, sr = sintetizar(texto, voz, vel)
        dur = len(audio) / sr
        frases.append({"i": i, "texto": texto, "s": round(t, 3), "e": round(t + dur, 3),
                       "palabras": palabras_con_tiempo(texto, t, t + dur),
                       **({} if isinstance(linea, str) else {k: v for k, v in linea.items() if k != "texto"})})
        trozos += [audio, np.zeros(int(PAUSA * sr), dtype=np.float32)]
        t += dur + PAUSA

    sf.write(dest / "voz.wav", np.concatenate(trozos), sr)
    (dest / "subs.srt").write_text("\n".join(
        f"{f['i'] + 1}\n{srt_t(f['s'])} --> {srt_t(f['e'])}\n{f['texto']}\n" for f in frases), encoding="utf-8")
    props = {"id": g["id"], "titulo": g.get("titulo", ""), "audio": f"{g['id']}/voz.wav",
             "duracion": round(t + 0.5, 3), "frases": frases, "estilo": g.get("estilo", {})}
    (dest / "props.json").write_text(json.dumps(props, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"OK {dest}  ({props['duracion']}s, {len(frases)} frases, voz {voz})")


if __name__ == "__main__":
    main(sys.argv[1])
