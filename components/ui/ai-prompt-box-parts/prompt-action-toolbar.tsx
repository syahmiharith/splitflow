"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, BrainCog, FolderCode, Globe, Mic, MoreHorizontal, Paperclip, Square, StopCircle } from "lucide-react";
import { Button, cn, CustomDivider, PromptInputAction, PromptInputActions } from "@/components/ui/ai-prompt-box-parts/prompt-input-primitives";

export function PromptActionToolbar({
  isRecording,
  isLoading,
  hasContent,
  showSearch,
  showThink,
  showCanvas,
  uploadInputRef,
  processFile,
  onToggleMode,
  onToggleCanvas,
  onSubmitAction
}: {
  isRecording: boolean;
  isLoading: boolean;
  hasContent: boolean;
  showSearch: boolean;
  showThink: boolean;
  showCanvas: boolean;
  uploadInputRef: React.RefObject<HTMLInputElement | null>;
  processFile: (file: File) => void;
  onToggleMode: (value: "search" | "think") => void;
  onToggleCanvas: () => void;
  onSubmitAction: () => void;
}) {
  const [mobileToolsOpen, setMobileToolsOpen] = React.useState(false);

  return (
    <PromptInputActions className="relative flex items-center justify-between gap-2 p-0 pt-2">
      <div className={cn("flex min-w-0 items-center gap-1 transition-opacity duration-300", isRecording ? "invisible h-0 opacity-0" : "visible opacity-100")}>
        <PromptInputAction tooltip="Upload image">
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-app-muted transition-colors hover:bg-slate-100 hover:text-app-text"
            disabled={isRecording}
          >
            <Paperclip className="h-5 w-5 transition-colors" />
            <input
              ref={uploadInputRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                if (event.target.files && event.target.files.length > 0) processFile(event.target.files[0]);
                event.currentTarget.value = "";
              }}
              accept="image/*"
            />
          </button>
        </PromptInputAction>

        <button
          type="button"
          onClick={() => setMobileToolsOpen((current) => !current)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-app-muted transition-colors hover:bg-slate-100 hover:text-app-text md:hidden"
          aria-label="More composer tools"
          aria-expanded={mobileToolsOpen}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="hidden min-w-0 items-center md:flex">
          <ModeButton
            active={showSearch}
            activeClassName="border-app-blue bg-blue-50 text-app-blue"
            icon={Globe}
            label="Search"
            onClick={() => onToggleMode("search")}
          />

          <CustomDivider />

          <ModeButton
            active={showThink}
            activeClassName="border-app-violet bg-violet-50 text-app-violet"
            icon={BrainCog}
            label="Think"
            onClick={() => onToggleMode("think")}
          />

          <CustomDivider />

          <ModeButton
            active={showCanvas}
            activeClassName="border-app-amber bg-amber-50 text-app-amber"
            icon={FolderCode}
            label="Canvas"
            onClick={onToggleCanvas}
          />
        </div>
      </div>

      <PromptInputAction
        tooltip={
          isLoading
            ? "Stop generation"
            : isRecording
              ? "Stop recording"
              : hasContent
                ? "Send message"
                : "Voice message"
        }
      >
        <Button
          variant="default"
          size="icon"
          data-testid="chat-send"
          className={cn(
            "h-9 w-9 shrink-0 rounded-full transition-all duration-200",
            isRecording
              ? "bg-transparent text-app-red hover:bg-red-50 hover:text-app-red"
              : hasContent
                ? "bg-app-blue text-white hover:bg-blue-700"
                : "bg-slate-100 text-app-muted hover:bg-slate-200 hover:text-app-text"
          )}
          onClick={onSubmitAction}
          disabled={isLoading && !hasContent}
        >
          {isLoading ? (
            <Square className="h-4 w-4 animate-pulse fill-current" />
          ) : isRecording ? (
            <StopCircle className="h-5 w-5" />
          ) : hasContent ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
      </PromptInputAction>
      {mobileToolsOpen ? (
        <div className="absolute bottom-[76px] left-3 right-3 z-10 grid gap-2 rounded-lg border border-app-border bg-white p-2 shadow-soft md:hidden" data-testid="mobile-composer-tools">
          <MobileToolButton active={showSearch} label="Search" onClick={() => onToggleMode("search")} />
          <MobileToolButton active={showThink} label="Think" onClick={() => onToggleMode("think")} />
          <MobileToolButton active={showCanvas} label="Canvas" onClick={onToggleCanvas} />
        </div>
      ) : null}
    </PromptInputActions>
  );
}

function ModeButton({
  active,
  activeClassName,
  icon: Icon,
  label,
  onClick
}: {
  active: boolean;
  activeClassName: string;
  icon: typeof Globe;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1 rounded-full border px-2 py-1 transition-all",
        active ? activeClassName : "border-transparent bg-transparent text-app-muted hover:text-app-text"
      )}
    >
      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
        <motion.div
          animate={{ rotate: active ? 360 : 0, scale: active ? 1.1 : 1 }}
          whileHover={{ rotate: active ? 360 : 15, scale: 1.1 }}
          transition={{ type: "spring", stiffness: 260, damping: 25 }}
        >
          <Icon className="h-4 w-4" />
        </motion.div>
      </div>
      <AnimatePresence>
        {active ? (
          <motion.span
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 overflow-hidden whitespace-nowrap text-xs"
          >
            {label}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </button>
  );
}

function MobileToolButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-10 items-center justify-between rounded-md px-3 text-left text-sm font-semibold",
        active ? "bg-blue-50 text-app-blue" : "text-app-text hover:bg-slate-50"
      )}
    >
      {label}
      {active ? <span className="h-2 w-2 rounded-full bg-app-blue" aria-hidden="true" /> : null}
    </button>
  );
}
