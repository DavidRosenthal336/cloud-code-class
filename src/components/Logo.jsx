// Rose Valley Capital wordmark + hexagonal rose seal.
// Recreated from the office logo photograph — refine when an official
// SVG asset becomes available. Uses currentColor so the parent controls
// the fill (intended: light gray on navy).
export default function Logo({ className = '', markOnly = false }) {
  if (markOnly) {
    return (
      <svg
        viewBox="0 0 80 90"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        aria-label="Rose Valley Capital"
        className={className}
      >
        <Mark />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 360 90"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      aria-label="Rose Valley Capital"
      className={className}
    >
      <g transform="translate(0,0)">
        <Mark />
      </g>
      <g transform="translate(95,0)">
        <text
          x="0"
          y="48"
          fontFamily="'Times New Roman', Georgia, serif"
          fontSize="30"
          letterSpacing="2.4"
          fontWeight="500"
        >
          ROSE VALLEY
        </text>
        <text
          x="0"
          y="74"
          fontFamily="'Times New Roman', Georgia, serif"
          fontSize="13"
          letterSpacing="9"
          fontWeight="400"
        >
          CAPITAL
        </text>
      </g>
    </svg>
  );
}

function Mark() {
  return (
    <g transform="translate(40,45)">
      <polygon
        points="0,-36 31,-18 31,18 0,36 -31,18 -31,-18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {/* Stylized rose: three angular petals converging at the center */}
      <path d="M0,-22 L-7,0 L0,4 L7,0 Z" />
      <path d="M-19,11 L-2,2 L-7,22 Z" opacity="0.9" />
      <path d="M19,11 L2,2 L7,22 Z" opacity="0.9" />
    </g>
  );
}
