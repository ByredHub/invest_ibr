"use client";

import { useState, type ClipboardEvent } from "react";
import { formatPhoneInput, formatPhonePaste } from "@/lib/phone";

interface Props {
  name?: string;
  value?: string;
  onChange?: (formatted: string) => void;
  className?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
}

export function PhoneInput({ name, value, onChange, className = "input", required, placeholder = "+7 900 000-00-00", autoComplete }: Props) {
  const [inner, setInner] = useState("");
  const current = value ?? inner;

  function set(next: string) {
    setInner(next);
    onChange?.(next);
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    const next = formatPhonePaste(text);
    if (!next) return;
    e.preventDefault();
    set(next);
  }

  return (
    <input
      name={name}
      type="tel"
      inputMode="tel"
      className={className}
      placeholder={placeholder}
      required={required}
      autoComplete={autoComplete}
      value={current}
      onFocus={() => {
        if (!current) set("+7 ");
      }}
      onBlur={() => {
        if (!formatPhoneInput(current)) set("");
      }}
      onChange={(e) => set(formatPhoneInput(e.target.value, current) || (e.target.value ? "+7 " : ""))}
      onPaste={onPaste}
    />
  );
}
