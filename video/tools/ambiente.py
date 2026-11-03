"""Ambiente sonoro de terror generado por código (sin licencias): drone grave,
latidos y golpes graves en los momentos de susto."""
import numpy as np

SR = 24000


def _env(n, a, r):
    e = np.ones(n)
    a, r = int(a * SR), int(r * SR)
    e[:a] = np.linspace(0, 1, a)
    e[-r:] = np.linspace(1, 0, r)
    return e


def drone(dur, rng):
    t = np.arange(int(dur * SR)) / SR
    s = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * g
            for f, g in [(43.65, .5), (46.2, .35), (87.3, .15), (130.8, .06)])
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * t)
    ruido = np.convolve(rng.standard_normal(len(t)), np.ones(400) / 400, "same") * 1.5
    return (s * lfo + ruido * 0.3) * _env(len(t), 2, 2)


def latido(rng):
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    golpe = np.sin(2 * np.pi * 55 * t * (1 - t)) * np.exp(-t * 25)
    out = np.zeros(int(0.45 * SR))
    out[:n] += golpe
    out[int(0.22 * SR):int(0.22 * SR) + n] += golpe * 0.7
    return out


def impacto(rng):
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    f = 70 * np.exp(-t * 1.5) + 30
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    s += rng.standard_normal(n) * np.exp(-t * 18) * 0.5
    return s


def generar(dur, sustos=(), latidos=True, seed=7):
    rng = np.random.default_rng(seed)
    pista = drone(dur, rng) * 0.25
    if latidos:
        l = latido(rng)
        for t0 in np.arange(1.0, dur - 1, 1.1):
            i = int(t0 * SR)
            pista[i:i + len(l)] += l[:len(pista) - i] * 0.35
    for t0 in sustos:
        s, i = impacto(rng), int(t0 * SR)
        pista[i:i + len(s)] += s[:max(0, len(pista) - i)] * 0.9
    return (pista / max(1e-6, np.abs(pista).max()) * 0.8).astype(np.float32)
