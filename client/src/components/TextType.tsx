import { useEffect, useRef } from "react";

interface TextTypeProps {
  text: string;
  className?: string;
  delay?: number;
  minSpeed?: number;
  maxSpeed?: number;
  split?: string;
  reducedMotion?: boolean;
}

/**
 * TextType component from React Bits.
 * Simulates a terminal-style typing animation for signal status text.
 * Suitable for ocean evidence desk signal indicators.
 */
const TextType: React.FC<TextTypeProps> = ({
  text,
  className,
  delay = 30,
  minSpeed = 50,
  maxSpeed = 100,
  split = "|",
  reducedMotion = false,
}) => {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!elRef.current) return;

    if (reducedMotion) {
      elRef.current.textContent = text;
      return;
    }

    const characters = text.split("");
    let currentIndex = 0;
    let isDeleting = false;
    let timeout: ReturnType<typeof setTimeout>;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const animate = async () => {
      if (!elRef.current) return;

      if (isDeleting) {
        currentIndex -= 1;
        if (currentIndex < 0) {
          currentIndex = 0;
          isDeleting = false;
        }
      } else {
        const visibleText = characters.slice(0, currentIndex + 1).join("");
        elRef.current.textContent = visibleText;
        currentIndex += 1;
        if (currentIndex >= characters.length) {
          isDeleting = true;
        }
      }

      const speed = Math.random() * (maxSpeed - minSpeed) + minSpeed;
      timeout = setTimeout(animate, isDeleting ? speed / 2 : delay);
    };

    animate();

    return () => clearTimeout(timeout);
  }, [text, delay, minSpeed, maxSpeed, reducedMotion]);

  return (
    <span
      ref={elRef}
      className={className}
      style={{
        ...(reducedMotion ? {} : { borderBottom: "1px blinking-caret" }),
      }}
    />
  );
};

// Inject caret animation
if (typeof document !== "undefined" && !document.getElementById("text-type-caret")) {
  const style = document.createElement("style");
  style.id = "text-type-caret";
  style.textContent = `
@keyframes blinking-caret {
  0%, 50% { border-color: transparent; }
  50%, 100% { border-color: #5EEAD4; }
}
`;
  document.head.appendChild(style);
}

export default TextType;
