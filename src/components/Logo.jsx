// Rose Valley Capital horizontal logo — uses the official asset at /public/rvc-logo.png.
// The login screen places the logo on a white card so the brand colors render
// faithfully. The in-app header sits on navy and uses an inverted filter to
// render the logo in light gray, matching the rest of the dark-bar styling.
export default function Logo({ className = '', invert = false }) {
  return (
    <img
      src="/rvc-logo.png"
      alt="Rose Valley Capital"
      className={className}
      style={
        invert
          ? { filter: 'brightness(0) invert(1) opacity(0.85)' }
          : undefined
      }
    />
  );
}
