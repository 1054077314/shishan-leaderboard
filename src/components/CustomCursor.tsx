import React, { useEffect, useState } from "react";

interface CustomCursorProps {
  mode: "default" | "lens" | "button";
  lensSize?: number;
  enabled: boolean;
}

export const CustomCursor: React.FC<CustomCursorProps> = ({
  mode,
  lensSize = 140,
  enabled,
}) => {
  const [pos, setPos] = useState({ x: -200, y: -200 });
  const [isVisible, setIsVisible] = useState(false);
  const [isFinePointer, setIsFinePointer] = useState(true);

  useEffect(() => {
    // Check if pointer is fine (desktop mouse)
    const mediaQuery = window.matchMedia("(pointer: fine)");
    setIsFinePointer(mediaQuery.matches);

    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsFinePointer(e.matches);
    };
    mediaQuery.addEventListener("change", handleMediaChange);

    const handleMouseMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      mediaQuery.removeEventListener("change", handleMediaChange);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
    };
  }, [isVisible]);

  if (!enabled || !isFinePointer || !isVisible) {
    return null;
  }

  const isLens = mode === "lens";
  const isButton = mode === "button";

  const size = isLens ? lensSize : isButton ? 44 : 20;

  return (
    <>
      {/* Outer follow circle */}
      <div
        className="fixed pointer-events-none z-50 rounded-full transition-transform duration-75 ease-out -translate-x-1/2 -translate-y-1/2"
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          width: `${size}px`,
          height: `${size}px`,
          border: isLens
            ? "1px solid rgba(190, 18, 60, 0.35)"
            : isButton
            ? "1px solid rgba(28, 25, 23, 0.28)"
            : "1px solid rgba(190, 18, 60, 0.2)",
          backgroundColor: isLens
            ? "rgba(190, 18, 60, 0.08)"
            : isButton
            ? "rgba(255, 255, 255, 0.7)"
            : "transparent",
          backdropFilter: "none",
          boxShadow: isLens ? "0 8px 20px rgba(28, 25, 23, 0.1)" : "none",
        }}
      />
      {/* Precision inner center dot */}
      <div
        className="fixed pointer-events-none z-50 rounded-full -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          width: isLens ? "6px" : "4px",
          height: isLens ? "6px" : "4px",
          backgroundColor: isLens ? "#be123c" : "#1c1917",
        }}
      />
    </>
  );
};
