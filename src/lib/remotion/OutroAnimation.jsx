import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

export function OutroAnimation({ ctaText = "", brandText = "thumbpin.ai" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.7], [0, 1], {
    extrapolateRight: "clamp",
  });

  const lineWidth = interpolate(
    frame,
    [fps * 0.6, fps * 1.6],
    [0, 100],
    { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
  );

  const textOpacity = interpolate(frame, [fps * 0.8, fps * 1.8], [0, 1], {
    extrapolateRight: "clamp",
  });

  const textY = interpolate(frame, [fps * 0.8, fps * 1.8], [20, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const brandOpacity = interpolate(frame, [fps * 1.4, fps * 2.2], [0, 0.5], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#ffffff",
        opacity: fadeIn,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 60px",
      }}
    >
      {/* CTA text */}
      {ctaText && (
        <div
          style={{
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
            fontFamily: "'Georgia', 'Times New Roman', serif",
            fontSize: 38,
            fontWeight: 400,
            color: "#0a0a0a",
            letterSpacing: 1,
            textAlign: "center",
            lineHeight: 1.45,
            marginBottom: 36,
            maxWidth: 900,
          }}
        >
          {ctaText}
        </div>
      )}

      {/* Gold divider */}
      <div
        style={{
          width: lineWidth,
          height: 1.5,
          backgroundColor: "#C9A84C",
          marginBottom: 28,
        }}
      />

      {/* thumbpin brand */}
      <div
        style={{
          opacity: brandOpacity,
          fontFamily: "'Arial', 'Helvetica', sans-serif",
          fontSize: 14,
          fontWeight: 300,
          color: "#bbbbbb",
          letterSpacing: 4,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {brandText}
      </div>
    </AbsoluteFill>
  );
}
