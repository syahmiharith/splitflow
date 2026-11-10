import "@testing-library/jest-dom/vitest";

// Radix floating controls use browser APIs absent from jsdom.
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
