import { Composition } from "remotion";
import { SeedanceReelComposition } from "./SeedanceReelComposition";
import { calcDurationInFrames } from "./duration";

export const RemotionRoot = () => {
  return (
    <Composition
      id="SeedanceReel"
      component={SeedanceReelComposition}
      fps={30}
      width={1080}
      height={1920}
      durationInFrames={calcDurationInFrames()}
      defaultProps={{
        avatarVideoUrl: "",
        brollClips: [],
        ctaVideoUrl: "",
        part2AudioUrl: "",
        avatarDuration: 15,
        ctaDuration: 10,
        ctaText: "",
      }}
    />
  );
};
