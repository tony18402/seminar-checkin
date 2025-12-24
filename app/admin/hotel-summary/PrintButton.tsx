// app/admin/hotel-summary/PrintButton.tsx
"use client";

import * as React from "react";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid #ccc",
        background: "white",
        cursor: "pointer",
        fontWeight: 700,
      }}
    >
      พิมพ์ / Print
    </button>
  );
}
