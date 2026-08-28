import { useEffect, useRef } from "react";

interface GradientProps {
  children?: React.ReactNode;
  className?: string;
  colors?: string[];
  duration?: number;
  reducedMotion?: boolean;
}

/**
 * Gradient component from React Bits.
 * Animates between gradient colors for ocean-themed backgrounds.
 * Respects prefers-reduced-motion.
 */
const Gradient: React.FC<GradientProps> = ({
  children,
  className,
  colors = ["#5EEAD4", "#0D9488", "#0EA5E9", "#3B82F6"],
  duration = 8,
  reducedMotion = false,
}) => {
  const gradientRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gradientRef.current || reducedMotion) return;

    const updateGradient = (t: number) => {
      if (!gradientRef.current) return;
      const phase = (t / duration) % 1;
      const next = colors.map((c, i) => {
        const pos = (phase + i / colors.length) % 1;
        return `${c} ${pos * 100}%`;
      }).join(", ");

      gradientRef.current.style.background = `linear-gradient(135deg, ${next})`;
    };

    let start = 0;
    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      updateGradient(elapsed / 1000);
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [colors, duration, reducedMotion]);

  return (
    <div
      ref={gradientRef}
      className={className}
      style={{
        background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
        transition: "background 0.3s ease",
        ...(reducedMotion && { animation: "none" }),
      }}
    >
      {children}
    </div>
  );
};

export default Gradient;
