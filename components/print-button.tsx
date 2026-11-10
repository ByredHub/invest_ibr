"use client";

import { Download } from "lucide-react";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-ghost">
      <Download size={16} /> Скачать PDF
    </button>
  );
}
