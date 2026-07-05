import { Composition } from "remotion";
import { SeedanceReelComposition } from "./SeedanceReelComposition";
import { NewsAnchorComposition } from "./NewsAnchorComposition";
import { BrollComposition, calcBrollDurationInFrames } from "./BrollComposition";
import { ActionReelComposition } from "./ActionReelComposition";
import { calcDurationInFrames, calcActionReelDurationInFrames } from "./duration";

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
        }}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: calcDurationInFrames({
            avatarDuration: props.avatarDuration,
            brollClips:     props.brollClips,
            ctaDuration:    props.ctaDuration,
            showIntro:      props.showIntro,
            showOutro:      props.showOutro,
          }),
        })}
      />
      <Composition
        id="NewsAnchor"
        component={NewsAnchorComposition}
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
        calculateMetadata={async ({ props }) => ({
          durationInFrames: calcDurationInFrames({
            avatarDuration: props.avatarDuration,
            brollClips:     props.brollClips,
            ctaDuration:    props.ctaDuration,
            showIntro:      props.showIntro,
            showOutro:      props.showOutro,
          }),
        })}
      />
      <Composition
        id="NewsAnchorBroll"
        component={BrollComposition}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={calcBrollDurationInFrames()}
        defaultProps={{
          mediaItems: [],
          presetId: "cinematic",
          musicUrl: "",
        }}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: calcBrollDurationInFrames({
            mediaItems: props.mediaItems,
            presetId:   props.presetId,
          }),
        })}
      />
      <Composition
        id="ActionReel"
        component={ActionReelComposition}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={calcActionReelDurationInFrames()}
        defaultProps={{
          part1VideoUrl: "",
          part2VideoUrl: "",
          part1Duration: 15,
          part2Duration: 15,
        }}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: calcActionReelDurationInFrames({
            part1Duration: props.part1Duration,
            part2Duration: props.part2Duration,
          }),
        })}
      />
    </>
  );
};
