"use client";

import React from "react";
import { X } from "lucide-react";
import { ImageViewDialog } from "@/components/ui/ai-prompt-box-parts/image-view-dialog";
import { PromptActionToolbar } from "@/components/ui/ai-prompt-box-parts/prompt-action-toolbar";
import { cn, PromptInput, PromptInputTextarea } from "@/components/ui/ai-prompt-box-parts/prompt-input-primitives";
import { usePromptBoxStyles } from "@/components/ui/ai-prompt-box-parts/use-prompt-box-styles";
import { VoiceRecorder } from "@/components/ui/ai-prompt-box-parts/voice-recorder";

interface PromptInputBoxProps {
  onSend?: (message: string, files?: File[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  maxTextareaHeight?: number;
}

export const PromptInputBox = React.forwardRef<HTMLDivElement, PromptInputBoxProps>(
  ({ onSend = () => {}, isLoading = false, placeholder = "Type your message here...", className, maxTextareaHeight }, ref) => {
    usePromptBoxStyles();

    const [input, setInput] = React.useState("");
    const [files, setFiles] = React.useState<File[]>([]);
    const [filePreviews, setFilePreviews] = React.useState<{ [key: string]: string }>({});
    const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
    const [isRecording, setIsRecording] = React.useState(false);
    const [showSearch, setShowSearch] = React.useState(false);
    const [showThink, setShowThink] = React.useState(false);
    const [showCanvas, setShowCanvas] = React.useState(false);
    const uploadInputRef = React.useRef<HTMLInputElement>(null);
    const promptBoxRef = React.useRef<HTMLDivElement>(null);
    const responsiveMaxHeight = useResponsiveTextareaMaxHeight();
    const textareaMaxHeight = maxTextareaHeight ?? responsiveMaxHeight;

    const isImageFile = React.useCallback((file: File) => file.type.startsWith("image/"), []);

    const processFile = React.useCallback(
      (file: File) => {
        if (!isImageFile(file) || file.size > 10 * 1024 * 1024) return;
        setFiles([file]);
        const reader = new FileReader();
        reader.onload = (event) => setFilePreviews({ [file.name]: event.target?.result as string });
        reader.readAsDataURL(file);
      },
      [isImageFile]
    );

    const handleToggleChange = (value: string) => {
      if (value === "search") {
        setShowSearch((current) => !current);
        setShowThink(false);
      } else if (value === "think") {
        setShowThink((current) => !current);
        setShowSearch(false);
      }
    };

    const handleCanvasToggle = () => setShowCanvas((current) => !current);

    const handleDragOver = React.useCallback((event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
    }, []);

    const handleDragLeave = React.useCallback((event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
    }, []);

    const handleDrop = React.useCallback(
      (event: React.DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const imageFile = Array.from(event.dataTransfer.files).find((file) => isImageFile(file));
        if (imageFile) processFile(imageFile);
      },
      [isImageFile, processFile]
    );

    const handleRemoveFile = (index: number) => {
      const fileToRemove = files[index];
      if (fileToRemove && filePreviews[fileToRemove.name]) setFilePreviews({});
      setFiles([]);
    };

    const openImageModal = (imageUrl: string) => setSelectedImage(imageUrl);

    const handlePaste = React.useCallback(
      (event: ClipboardEvent) => {
        const items = event.clipboardData?.items;
        if (!items) return;
        for (let index = 0; index < items.length; index += 1) {
          if (items[index].type.indexOf("image") !== -1) {
            const file = items[index].getAsFile();
            if (file) {
              event.preventDefault();
              processFile(file);
              break;
            }
          }
        }
      },
      [processFile]
    );

    React.useEffect(() => {
      document.addEventListener("paste", handlePaste);
      return () => document.removeEventListener("paste", handlePaste);
    }, [handlePaste]);

    const handleSubmit = () => {
      if (!input.trim() && files.length === 0) return;

      let messagePrefix = "";
      if (showSearch) messagePrefix = "[Search: ";
      else if (showThink) messagePrefix = "[Think: ";
      else if (showCanvas) messagePrefix = "[Canvas: ";

      const formattedInput = messagePrefix ? `${messagePrefix}${input}]` : input;
      onSend(formattedInput, files);
      setInput("");
      setFiles([]);
      setFilePreviews({});
    };

    const handleStartRecording = () => undefined;

    const handleStopRecording = (duration: number) => {
      setIsRecording(false);
      onSend(`[Voice message - ${duration} seconds]`, []);
    };

    const hasContent = input.trim() !== "" || files.length > 0;

    return (
      <>
        <PromptInput
          value={input}
          onValueChange={setInput}
          isLoading={isLoading}
          maxHeight={textareaMaxHeight}
          onSubmit={handleSubmit}
          className={cn("w-full", isRecording && "border-app-red/70", className)}
          disabled={isLoading || isRecording}
          ref={ref || promptBoxRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {files.length > 0 && !isRecording ? (
            <div className="flex flex-wrap gap-2 p-0 pb-1 transition-all duration-300">
              {files.map((file, index) => (
                <div key={file.name} className="group relative">
                  {file.type.startsWith("image/") && filePreviews[file.name] ? (
                    <button
                      type="button"
                      className="h-16 w-16 overflow-hidden rounded-xl transition-all duration-300"
                      onClick={() => openImageModal(filePreviews[file.name])}
                    >
                      <img src={filePreviews[file.name]} alt={file.name} className="h-full w-full object-cover" />
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRemoveFile(index);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            handleRemoveFile(index);
                          }
                        }}
                        className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-0.5"
                      >
                        <X className="h-3 w-3 text-white" />
                      </span>
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className={cn("transition-all duration-300", isRecording ? "h-0 overflow-hidden opacity-0" : "opacity-100")}>
            <PromptInputTextarea
              placeholder={
                showSearch
                  ? "Search the web..."
                  : showThink
                    ? "Think deeply..."
                    : showCanvas
                      ? "Create on canvas..."
                      : placeholder
              }
            />
          </div>

          {isRecording ? (
            <VoiceRecorder
              isRecording={isRecording}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
            />
          ) : null}

          <PromptActionToolbar
            isRecording={isRecording}
            isLoading={isLoading}
            hasContent={hasContent}
            showSearch={showSearch}
            showThink={showThink}
            showCanvas={showCanvas}
            uploadInputRef={uploadInputRef}
            processFile={processFile}
            onToggleMode={handleToggleChange}
            onToggleCanvas={handleCanvasToggle}
            onSubmitAction={() => {
              if (isRecording) setIsRecording(false);
              else if (hasContent) handleSubmit();
              else setIsRecording(true);
            }}
          />
        </PromptInput>

        <ImageViewDialog imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
      </>
    );
  }
);
PromptInputBox.displayName = "PromptInputBox";

function useResponsiveTextareaMaxHeight() {
  const [maxHeight, setMaxHeight] = React.useState(156);

  React.useEffect(() => {
    function syncMaxHeight() {
      setMaxHeight(window.innerWidth >= 768 ? 196 : 156);
    }

    syncMaxHeight();
    window.addEventListener("resize", syncMaxHeight);
    return () => window.removeEventListener("resize", syncMaxHeight);
  }, []);

  return maxHeight;
}
