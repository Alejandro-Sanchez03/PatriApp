import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { Video, VideoProps } from "./Video";
import { Reel, ReelProps } from "./Reel";

const FPS = 30;
const porDefecto: VideoProps = {
  id: "demo", titulo: "", audio: "", duracion: 5, frases: [], estilo: {},
};
const meta: CalculateMetadataFunction<VideoProps> = ({ props }) => ({
  durationInFrames: Math.ceil(props.duracion * FPS),
});

export const Root: React.FC = () => (
  <>
    <Composition id="Vertical" component={Video} width={1080} height={1920} fps={FPS}
      durationInFrames={150} defaultProps={porDefecto} calculateMetadata={meta} />
    <Composition id="Horizontal" component={Video} width={1920} height={1080} fps={FPS}
      durationInFrames={150} defaultProps={porDefecto} calculateMetadata={meta} />
    <Composition id="Reel" component={Reel} width={1080} height={1920} fps={FPS}
      durationInFrames={150} defaultProps={{ video: "", duracion: 5, textos: [], sustos: [] } as ReelProps}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.ceil(props.duracion * FPS) })} />
  </>
);
