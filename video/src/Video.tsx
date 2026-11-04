import React from "react";
import "@fontsource/montserrat/800.css";
import "@fontsource/montserrat/600.css";
import {
  AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";
import { Terror } from "./Terror";

export type Palabra = { w: string; s: number; e: number };
export type Frase = { i: number; texto: string; s: number; e: number; palabras: Palabra[]; tipo?: string };
export type VideoProps = {
  id: string; titulo: string; audio: string; duracion: number; frases: Frase[];
  estilo: { fondo?: string[]; acento?: string; tema?: string }; ambiente?: string | null;
};

const Fondo: React.FC<{ colores: string[] }> = ({ colores }) => {
  const f = useCurrentFrame();
  const ang = 135 + Math.sin(f / 60) * 20;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${ang}deg, ${colores[0]}, ${colores[1]})` }}>
      {[0, 1, 2].map((k) => (
        <div key={k} style={{
          position: "absolute", borderRadius: "50%", opacity: 0.18, background: "white",
          width: 300 + k * 160, height: 300 + k * 160,
          left: `${20 + k * 25 + Math.sin(f / (40 + k * 15)) * 8}%`,
          top: `${15 + k * 22 + Math.cos(f / (50 + k * 10)) * 6}%`,
          filter: "blur(40px)",
        }} />
      ))}
    </AbsoluteFill>
  );
};

const Subtitulos: React.FC<{ frases: Frase[]; acento: string; vertical: boolean }> = ({ frases, acento, vertical }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const frase = frases.find((x) => t >= x.s && t < x.e + 0.3);
  if (!frase) return null;
  const pop = spring({ frame: f - Math.round(frase.s * fps), fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{
      justifyContent: vertical ? "center" : "flex-end", alignItems: "center",
      padding: vertical ? "0 80px" : "0 160px 110px",
    }}>
      <div style={{
        fontFamily: "Montserrat", fontWeight: 800, fontSize: vertical ? 78 : 64, lineHeight: 1.2,
        textAlign: "center", color: "white", display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: "0.32em", textShadow: "0 6px 24px rgba(0,0,0,.45)",
        transform: `scale(${interpolate(pop, [0, 1], [0.85, 1])})`, opacity: pop,
      }}>
        {frase.palabras.map((p, k) => {
          const activa = t >= p.s && t < p.e;
          return (
            <span key={k} style={{
              color: activa ? acento : "white", display: "inline-block",
              transform: activa ? "translateY(-6px)" : "none",
            }}>{p.w}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Video: React.FC<VideoProps> = (props) => {
  const { audio, frases, estilo } = props;
  if (estilo.tema === "terror") return <Terror {...props} />;
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Fondo colores={estilo.fondo ?? ["#0f172a", "#1e3a8a"]} />
      <Subtitulos frases={frases} acento={estilo.acento ?? "#facc15"} vertical={height > width} />
      {audio ? <Audio src={staticFile(audio)} /> : null}
    </AbsoluteFill>
  );
};
