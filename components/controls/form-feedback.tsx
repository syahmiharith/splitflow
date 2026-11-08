"use client";
import { useEffect } from "react";
/** Keep native constraint enforcement, replacing browser bubbles with linked inline feedback. */
export function FormFeedback() {
  useEffect(() => {
    let clear: (() => void) | undefined;
    let inBatch = false;
    function invalid(event: Event) {
      const field = event.target;
      if (!(
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement
      ))
        return;
      event.preventDefault();
      if (inBatch) return;
      inBatch = true;
      queueMicrotask(() => {
        inBatch = false;
      });
      clear?.();
      const message = document.createElement("span");
      message.id = `field-feedback-${crypto.randomUUID()}`;
      message.className = "sf-field-feedback";
      message.setAttribute("role", "alert");
      message.textContent = field.validity.valueMissing
        ? "Please fill in this field."
        : field.validationMessage;
      const described = field.getAttribute("aria-describedby");
      const previousInvalid = field.getAttribute("aria-invalid");
      field.setAttribute("aria-invalid", "true");
      field.setAttribute(
        "aria-describedby",
        [described, message.id].filter(Boolean).join(" "),
      );
      (field.closest("label") ?? field).insertAdjacentElement(
        "afterend",
        message,
      );
      field.focus();
      const reset = () => {
        message.remove();
        if (described === null) field.removeAttribute("aria-describedby");
        else field.setAttribute("aria-describedby", described);
        if (previousInvalid === null) field.removeAttribute("aria-invalid");
        else field.setAttribute("aria-invalid", previousInvalid);
        field.removeEventListener("input", reset);
        field.removeEventListener("change", reset);
        field.form?.removeEventListener("submit", reset);
      };
      field.addEventListener("input", reset);
      field.addEventListener("change", reset);
      field.form?.addEventListener("submit", reset);
      clear = reset;
    }
    document.addEventListener("invalid", invalid, true);
    return () => {
      clear?.();
      document.removeEventListener("invalid", invalid, true);
    };
  }, []);
  return null;
}
