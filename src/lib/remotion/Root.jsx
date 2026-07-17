import { Composition } from "remotion";
import { SeedanceReelComposition, calcSeedanceReelDurationInFrames } from "./SeedanceReelComposition";
import { ActionReelComposition, calcActionReelDurationInFrames } from "./ActionReelComposition";
import { calcDurationInFrames, calcActionReelBaseDurationInFrames } from "./duration";

export const RemotionRoot = () => {
  return (
    <>
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
          cutRanges: [],
        }}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: calcSeedanceReelDurationInFrames({
            avatarDuration: props.avatarDuration,
            brollClips:     props.brollClips,
            ctaDuration:    props.ctaDuration,
            showIntro:      props.showIntro,
            showOutro:      props.showOutro,
            cutRanges:      props.cutRanges,
          }),
        })}
      />
      <Composition
        id="ActionReel"
        component={ActionReelComposition}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={calcActionReelBaseDurationInFrames()}
        defaultProps={{
          part1VideoUrl: "",
          part2VideoUrl: "",
          part1Duration: 15,
          part2Duration: 15,
          overlays: [],
          musicUrl: "",
          musicTrimStartSeconds: 0,
          musicVolume: 0.25,
          cutRanges: [],
        }}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: calcActionReelDurationInFrames({
            part1Duration: props.part1Duration,
            part2Duration: props.part2Duration,
            cutRanges:     props.cutRanges,
          }),
        })}
      />
    </>
  );
};
