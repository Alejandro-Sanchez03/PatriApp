import React from "react";
import "@fontsource/creepster/400.css";
import "@fontsource/oswald/700.css";
import {
  AbsoluteFill, Audio, interpolate, OffthreadVideo, random, spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";
import { Grano, ROJO } from "./Terror";

export type Texto = { texto: string; s: number; e: number; tipo?: "titulo" | "susto" | "normal"; pos?: "arriba" | "centro" | "abajo" };
export type ReelProps = {
  video: string; duracion: number; textos: Texto[]; sustos: number[]; ambiente?: string | null; firma?: string;
};

const Rotulo: React.FC<{ x: Texto; t: number }> = ({ x, t }) => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  const entra = spring({ frame: f - Math.round(x.s * fps), fps, config: { damping: x.tipo === "susto" ? 8 : 14 } });
  const sale = interpolate(t, [x.e - 0.2, x.e], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tiembla = x.tipo === "titulo" || x.tipo === "susto" ? (random(`r${f}`) - 0.5) * 8 : 0;
  const pos = x.pos ?? (x.tipo === "titulo" ? "centro" : "abajo");
  const titulo = x.tipo === "titulo";
  return (
    <AbsoluteFill style={{
      alignItems: "center", padding: vertical ? "0 60px" : "0 140px",
      justifyContent: pos === "arriba" ? "flex-start" : pos === "centro" ? "center" : "flex-end",
      paddingTop: pos === "arriba" ? (vertical ? 260 : 90) : 0, paddingBottom: pos === "abajo" ? (vertical ? 420 : 100) : 0,
    }}>
      <div style={{
        fontFamily: titulo ? "Creepster" : "Oswald", fontWeight: titulo ? 400 : 700,
        textTransform: titulo ? "none" : "uppercase", textAlign: "center", lineHeight: 1.1,
        fontSize: (vertical ? 1 : 0.8) * (titulo ? 150 : x.tipo === "susto" ? 104 : 76),
        color: titulo || x.tipo === "susto" ? ROJO : "#fff",
        textShadow: titulo ? "0 0 40px rgba(225,29,46,.8), 0 6px 20px #000" : "0 0 18px #000, 0 4px 6px #000, 0 0 40px rgba(0,0,0,.8)",
        WebkitTextStroke: titulo ? "2px #000" : undefined,
        opacity: entra * sale, transform: `translateX(${tiembla}px) scale(${interpolate(entra, [0, 1], [x.tipo === "susto" ? 1.8 : 0.8, 1])})`,
      }}>{x.texto}</div>
    </AbsoluteFill>
  );
};

export const Reel: React.FC<ReelProps> = ({ video, textos, sustos, ambiente, firma }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const ult = [...sustos].reverse().find((s) => t >= s);
  const flash = ult !== undefined ? Math.max(0, 1 - (t - ult) * 4) : 0;
  const zoom = 1.04 + flash * 0.08;
  const parpadeo = random(`p${Math.floor(f / 2)}`) < 0.03 ? 0.75 : 1;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${zoom}) translate(${(random(`sx${f}`) - .5) * flash * 30}px, ${(random(`sy${f}`) - .5) * flash * 30}px)` }}>
        <OffthreadVideo src={staticFile(video)} style={{
          width: "100%", height: "100%", objectFit: "cover",
          filter: `contrast(1.25) saturate(0.65) brightness(${0.8 * parpadeo}) sepia(0.25) hue-rotate(-15deg)`,
        }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(120,0,10,.18)", mixBlendMode: "multiply" }} />
      <AbsoluteFill style={{ background: ROJO, opacity: flash * 0.5, mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 260px 110px #000" }} />
      <Grano />
      {textos.filter((x) => t >= x.s && t < x.e).map((x, i) => <Rotulo key={i} x={x} t={t} />)}
      {firma ? (
        <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 120 }}>
          <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 34, letterSpacing: 6, color: "rgba(255,255,255,.75)", textShadow: "0 0 10px #000" }}>{firma}</div>
        </AbsoluteFill>
      ) : null}
      {ambiente ? <Audio src={staticFile(ambiente)} volume={0.25} /> : null}
    </AbsoluteFill>
  );
};
