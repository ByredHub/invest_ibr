"use client";

import { useState, type ClipboardEvent } from "react";
import { sanitizeMoneyInput } from "@/lib/money-input";

interface Props {
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  required?: boolean;
  placeholder?: string;
}

export function MoneyInput({ name, value, onChange, className = "input num", required, placeholder }: Props) {
  const [inner, setInner] = useState("");
  const current = value ?? inner;

  function set(next: string) {
    setInner(next);
    onChange?.(next);
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const text = sanitizeMoneyInput(e.clipboardData.getData("text"));
    if (!text) return;
    e.preventDefault();
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    set(current.slice(0, start) + text + current.slice(end));
  }

  return (
    <input
      name={name}
      className={className}
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      required={required}
      value={current}
      onChange={(e) => set(sanitizeMoneyInput(e.target.value))}
      onPaste={onPaste}
    />
  );
}
