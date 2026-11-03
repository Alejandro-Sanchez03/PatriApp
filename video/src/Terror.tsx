import React from "react";
import "@fontsource/creepster/400.css";
import "@fontsource/oswald/700.css";
import "@fontsource/special-elite/400.css";
import {
  AbsoluteFill, Audio, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";
import type { Frase, VideoProps } from "./Video";

export const ROJO = "#e11d2e";

// Niebla: manchas difusas que se desplazan despacio
const Niebla: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      {[0, 1, 2, 3].map((k) => (
        <div key={k} style={{
          position: "absolute", width: "120%", height: "45%", borderRadius: "50%",
          left: `${-30 + ((f * (0.08 + k * 0.03) + k * 40) % 90)}%`, top: `${10 + k * 22}%`,
          background: "radial-gradient(ellipse, rgba(200,200,210,.10), transparent 70%)",
          filter: "blur(30px)",
        }} />
      ))}
    </AbsoluteFill>
  );
};

// Grano de película con semilla distinta en cada fotograma
export const Grano: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: 0.13, mixBlendMode: "screen" }}>
      <svg width="100%" height="100%">
        <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={f % 50} /></filter>
        <rect width="100%" height="100%" filter="url(#g)" />
      </svg>
    </AbsoluteFill>
  );
};

const Fondo: React.FC<{ susto: number }> = ({ susto }) => {
  const f = useCurrentFrame();
  const parpadeo = random(`p${Math.floor(f / 2)}`) < 0.04 ? 0.55 : 1;
  return (
    <AbsoluteFill style={{ background: "#050505" }}>
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse at 50% ${40 + Math.sin(f / 90) * 5}%, #3a0a0f 0%, #120306 45%, #000 80%)`,
        opacity: parpadeo,
      }} />
      <Niebla />
      <AbsoluteFill style={{ background: ROJO, opacity: susto * 0.45, mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 300px 120px #000" }} />
      <Grano />
      <AbsoluteFill style={{
        background: "repeating-linear-gradient(0deg, rgba(0,0,0,.18) 0 2px, transparent 2px 4px)",
      }} />
    </AbsoluteFill>
  );
};

const Titulo: React.FC<{ frase: Frase; t: number; vertical: boolean }> = ({ frase, t, vertical }) => {
  const { fps } = useVideoConfig();
  const f = useCurrentFrame();
  const entra = spring({ frame: f - Math.round(frase.s * fps), fps, config: { damping: 200 }, durationInFrames: 25 });
  const sale = interpolate(t, [frase.e - 0.1, frase.e + 0.3], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tiembla = (random(`t${f}`) - 0.5) * 6;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 60 }}>
      <div style={{
        fontFamily: "Creepster", color: ROJO, fontSize: vertical ? 150 : 170, textAlign: "center", lineHeight: 1,
        textShadow: `0 0 40px rgba(225,29,46,.6), ${tiembla}px 0 0 rgba(0,255,255,.25)`,
        opacity: entra * sale, transform: `scale(${interpolate(entra, [0, 1], [1.4, 1])}) translateX(${tiembla}px)`,
        letterSpacing: 4,
      }}>{frase.texto}</div>
    </AbsoluteFill>
  );
};

const Subtitulos: React.FC<{ frase: Frase; t: number; vertical: boolean }> = ({ frase, t, vertical }) => {
  const { fps } = useVideoConfig();
  const f = useCurrentFrame();
  const entra = spring({ frame: f - Math.round(frase.s * fps), fps, config: { damping: 14 } });
  const esSusto = frase.tipo === "susto";
  const sacudida = esSusto ? Math.max(0, 1 - (t - frase.s) * 2) * 22 : 0;
  const dx = (random(`x${f}`) - 0.5) * sacudida, dy = (random(`y${f}`) - 0.5) * sacudida;
  return (
    <AbsoluteFill style={{
      justifyContent: vertical ? "center" : "flex-end", alignItems: "center",
      padding: vertical ? "0 70px" : "0 160px 110px",
    }}>
      <div style={{
        fontFamily: "Oswald", fontWeight: 700, textTransform: "uppercase", textAlign: "center",
        fontSize: (vertical ? 84 : 66) * (esSusto ? 1.25 : 1), lineHeight: 1.15, color: "#f2f2f2",
        display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: "0.28em",
        textShadow: "0 4px 30px #000, 0 0 12px #000", opacity: entra,
        transform: `translate(${dx}px, ${dy}px) scale(${interpolate(entra, [0, 1], [esSusto ? 1.6 : 0.9, 1])})`,
      }}>
        {frase.palabras.map((p, k) => {
          const activa = t >= p.s && t < p.e;
          const dicha = t >= p.e;
          return (
            <span key={k} style={{
              display: "inline-block", color: activa || esSusto ? ROJO : dicha ? "#f2f2f2" : "rgba(242,242,242,.55)",
              textShadow: activa ? "0 0 25px rgba(225,29,46,.8), 0 4px 30px #000" : undefined,
            }}>{p.w}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Terror: React.FC<VideoProps> = ({ audio, ambiente, frases }) => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = f / fps;
  const vertical = height > width;
  const frase = frases.find((x) => t >= x.s && t < x.e + 0.35);
  const ultSusto = [...frases].reverse().find((x) => x.tipo === "susto" && t >= x.s);
  const susto = ultSusto ? Math.max(0, 1 - (t - ultSusto.s) * 3) : 0;
  return (
    <AbsoluteFill>
      <Fondo susto={susto} />
      {frase && (frase.tipo === "titulo"
        ? <Titulo frase={frase} t={t} vertical={vertical} />
        : <Subtitulos frase={frase} t={t} vertical={vertical} />)}
      {audio ? <Audio src={staticFile(audio)} /> : null}
      {ambiente ? <Audio src={staticFile(ambiente)} volume={0.35} /> : null}
    </AbsoluteFill>
  );
};
