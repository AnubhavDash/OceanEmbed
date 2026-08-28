import { useEffect, useRef } from "react";

interface NoiseProps {
  children: React.ReactNode;
  speed?: number;
  intensity?: number;
  reducedMotion?: boolean;
}

/**
 * Noise component from React Bits.
 * Overlays an animated noisy texture suitable for ocean surface effects.
 * Respects prefers-reduced-motion.
 */
const Noise: React.FC<NoiseProps> = ({
  children,
  speed = 0.25,
  intensity = 0.02,
  reducedMotion = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    let frame = 0;
    const animate = () => {
      if (reducedMotion) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(135, 244, 240, 0.015)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
      }

      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const imageData = ctx.createImageData(canvas.width, canvas.height);
      const data = imageData.data;

      // Generate horizontal noise stripes
      for (let y = 0; y < canvas.height; y += 2) {
        const noise = Math.random() + Math.sin(frame * 0.02 + y * 0.05) * 0.5;
        const val = Math.floor((0.5 + noise * intensity) * 255);
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4;
          data[idx] = val;       // R
          data[idx + 1] = val;   // G
          data[idx + 2] = val;   // B
          data[idx + 3] = 8;     // alpha
        }
      }

      ctx.putImageData(imageData, 0, 0);
      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      // cleanup
    };
  }, [speed, intensity, reducedMotion]);

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          mixBlendMode: "screen",
          opacity: 0.3,
        }}
      />
      {children}
    </div>
  );
};

export default Noise;
