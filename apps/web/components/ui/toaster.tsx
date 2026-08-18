"use client";

import { Toaster } from "react-hot-toast";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3200,
        className: "text-sm font-medium",
        success: {
          iconTheme: {
            primary: "hsl(var(--success))",
            secondary: "white",
          },
        },
        error: {
          iconTheme: {
            primary: "hsl(var(--destructive))",
            secondary: "white",
          },
        },
      }}
    />
  );
}
