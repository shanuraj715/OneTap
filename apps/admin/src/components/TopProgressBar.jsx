import { useEffect, useState } from "react";

export function TopProgressBar({ active }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let t1, t2, t3;
    if (active) {
      setVisible(true);
      setProgress(25);
      t1 = setTimeout(() => setProgress(65), 100);
      t2 = setTimeout(() => setProgress(88), 280);
    } else {
      setProgress(100);
      t3 = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 250);
    }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [active]);

  if (!visible && !active) return null;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        left: 0,
        right: 0,
        width: "100%",
        height: 3,
        zIndex: 999,
        background: "transparent",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, var(--color-primary), #ff7a45, #f59e0b, var(--color-primary))",
          backgroundSize: "200% 100%",
          boxShadow: "0 0 10px rgba(198, 54, 47, 0.5), 0 0 4px rgba(245, 158, 11, 0.4)",
          transition: progress === 100 ? "width 120ms ease-out, opacity 200ms ease-out 120ms" : "width 260ms cubic-bezier(0.1, 0.5, 0.1, 1)",
          opacity: progress === 100 && !active ? 0 : 1,
          animation: "ot-top-bar-shimmer 1.8s linear infinite",
          borderRadius: "0 2px 2px 0",
        }}
      />
    </div>
  );
}

