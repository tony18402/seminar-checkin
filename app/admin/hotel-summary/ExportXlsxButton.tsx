// app/admin/hotel-summary/ExportXlsxButton.tsx
"use client";

import * as React from "react";

export default function ExportXlsxButton() {
  return (
    <button
      type="button"
      className="hsBtn hsBtnPrimary"
      onClick={() => {
        window.location.href = "/api/admin/export-hotel-food-summary-xlsx";
      }}
    >
      Export Excel (.xlsx)
    </button>
  );
}
