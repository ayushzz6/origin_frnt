export default function NoiseOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1] select-none"
      style={{
        backgroundImage: 'url(/noise.svg)',
        backgroundRepeat: 'repeat',
        backgroundSize: '128px 128px',
        opacity: 0.02,
        mixBlendMode: 'overlay',
      }}
    />
  );
}
