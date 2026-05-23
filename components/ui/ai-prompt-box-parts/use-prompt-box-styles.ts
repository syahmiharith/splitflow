"use client";

import React from "react";

const styles = `
  *:focus-visible {
    outline-offset: 0 !important;
    --ring-offset: 0 !important;
  }
  textarea::-webkit-scrollbar {
    width: 6px;
  }
  textarea::-webkit-scrollbar-track {
    background: transparent;
  }
  textarea::-webkit-scrollbar-thumb {
    background-color: #9ca3af;
    border-radius: 3px;
  }
  textarea::-webkit-scrollbar-thumb:hover {
    background-color: #667085;
  }
`;

export function usePromptBoxStyles() {
  React.useEffect(() => {
    if (document.getElementById("splitflow-ai-prompt-box-styles")) return;
    const styleSheet = document.createElement("style");
    styleSheet.id = "splitflow-ai-prompt-box-styles";
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
  }, []);
}
