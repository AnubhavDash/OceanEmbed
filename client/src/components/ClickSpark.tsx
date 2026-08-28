import { useState, useEffect } from "react";

interface ClickSparkProps {
  children: React.ReactNode;
  className?: string;
  reducedMotion?: boolean;
}

/**
 * ClickSpark component from React Bits.
 * Creates a sparkle effect on click/tap for interactive feedback.
 * Suitable for ocean evidence desk controls.
 */
const ClickSpark: React.FC<ClickSparkProps> = ({
  children,
  className,
  reducedMotion = false,
}) => {
  const [sparks, setSparks] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const handleClick = (e: React.MouseEvent<Element>) => {
    if (reducedMotion) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const id = Date.now() + Math.random();
    setSparks((prev) => [...prev, { id, x, y }]);

    // Remove spark after animation
    setTimeout(() => {
      setSparks((prev) => prev.filter((s) => s.id !== id));
    }, 800);
  };

  useEffect(() => {
    if (reducedMotion) return;
  }, [reducedMotion]);

  return (
    <span
      className={className}
      onClick={handleClick}
      style={{ position: "relative", display: "inline-block" }}
    >
      {children}
      {!reducedMotion &&
        sparks.map((spark) => (
          <span
            key={spark.id}
            style={{
              position: "absolute",
              left: spark.x,
              top: spark.y,
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#7dd3f9",
              boxShadow: "0 0 8px #7dd3f9",
              pointerEvents: "none",
              animation: "sparkle 0.8s ease-out forwards",
              zIndex: 10,
            }}
          />
        ))}
    </span>
  );
};

// Inject sparkle animation keyframes
const _injectSparkleStyles = () => `
@keyframes sparkle {
  0% { transform: scale(0.2) translate(-50%, -50%); opacity: 1; }
  100% { transform: scale(4) translate(-50%, -50%); opacity: 0; }
}
`;

// Ensure styles are injected
if (typeof document !== "undefined" && !document.getElementById("click-spark-styles")) {
  const style = document.createElement("style");
  style.id = "click-spark-styles";
  style.textContent = _injectSparkleStyles();
  document.head.appendChild(style);
}

export default ClickSpark;
