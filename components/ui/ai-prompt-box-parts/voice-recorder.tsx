"use client";

import React from "react";

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

export function VoiceRecorder({
  isRecording,
  onStartRecording,
  onStopRecording,
  visualizerBars = 32
}: {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: (duration: number) => void;
  visualizerBars?: number;
}) {
  const [time, setTime] = React.useState(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (isRecording) {
      onStartRecording();
      timerRef.current = setInterval(() => setTime((current) => current + 1), 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (time > 0) onStopRecording(time);
    setTime(0);
  }, [isRecording]);

  const barHeights = React.useMemo(
    () => Array.from({ length: visualizerBars }, (_, index) => 24 + ((index * 17) % 52)),
    [visualizerBars]
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("flex w-full flex-col items-center justify-center py-3 transition-all duration-300", isRecording ? "opacity-100" : "h-0 opacity-0")}>
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2 w-2 animate-pulse rounded-full bg-app-red" />
        <span className="font-mono text-sm text-app-text">{formatTime(time)}</span>
      </div>
      <div className="flex h-10 w-full items-center justify-center gap-0.5 px-4">
        {barHeights.map((height, index) => (
          <div
            key={index}
            className="w-0.5 animate-pulse rounded-full bg-app-blue/50"
            style={{
              height: `${height}%`,
              animationDelay: `${index * 0.05}s`,
              animationDuration: `${0.5 + (index % 5) * 0.1}s`
            }}
          />
        ))}
      </div>
    </div>
  );
}
