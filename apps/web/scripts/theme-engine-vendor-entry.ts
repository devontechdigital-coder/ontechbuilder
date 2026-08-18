import * as React from "react";
import * as ReactDOM from "react-dom/client";
import * as ReactJsxRuntime from "react/jsx-runtime";

declare global {
  interface Window {
    __THEME_ENGINE_VENDOR__: {
      React: typeof React;
      ReactDOM: typeof ReactDOM;
      ReactJsxRuntime: typeof ReactJsxRuntime;
    };
  }
}

window.__THEME_ENGINE_VENDOR__ = { React, ReactDOM, ReactJsxRuntime };
