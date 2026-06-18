import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

export function IntroAnimation() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Fade the whole card in/out
  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps * 0.5, durationInFrames],
    [1, 0],
    { extrapolateRight: "clamp" }
  );
  const containerOpacity = Math.min(fadeIn, fadeOut);

  // Gold line sweeps in from the centre outward
  const lineHalfWidth = interpolate(
    frame,
    [fps * 0.3, fps * 1.1],
    [0, 70],
    { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
  );

  // Main title rises + fades
  const titleY = interpolate(
    frame,
    [fps * 0.5, fps * 1.2],
    [28, 0],
    { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
  );
  const titleOpacity = interpolate(frame, [fps * 0.5, fps * 1.2], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Tagline delayed by a beat
  const subtitleOpacity = interpolate(
    frame,
    [fps * 1.1, fps * 1.8],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#ffffff",
        opacity: containerOpacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Gold line */}
      <div
        style={{
          width: lineHalfWidth * 2,
          height: 1.5,
          backgroundColor: "#C9A84C",
          marginBottom: 32,
        }}
      />

      {/* Property headline */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontFamily: "'Georgia', 'Times New Roman', serif",
          fontSize: 58,
          fontWeight: 400,
          color: "#0a0a0a",
          letterSpacing: 10,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        Luxury
      </div>
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontFamily: "'Georgia', 'Times New Roman', serif",
          fontSize: 34,
          fontWeight: 300,
          color: "#0a0a0a",
          letterSpacing: 14,
          textTransform: "uppercase",
          textAlign: "center",
          marginTop: 4,
        }}
      >
        Living
      </div>

      {/* Thin separator */}
      <div
        style={{
          width: lineHalfWidth * 0.6,
          height: 0.5,
          backgroundColor: "#C9A84C",
          margin: "24px auto",
          opacity: subtitleOpacity,
        }}
      />

      {/* Tagline */}
      <div
        style={{
          opacity: subtitleOpacity,
          fontFamily: "'Arial', 'Helvetica', sans-serif",
          fontSize: 16,
          fontWeight: 300,
          color: "#999999",
          letterSpacing: 5,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        Where Every Detail Matters
      </div>
    </AbsoluteFill>
  );
}
