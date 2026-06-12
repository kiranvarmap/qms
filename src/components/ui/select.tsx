"use client";

import * as React from "react";
import { Dropdown } from "@vibe/core";

/* Vibe Dropdown with a plain value/onChange API so it drops in wherever a
   native <select> was used. Use <MultiSelect> for multi-value pickers. */

/* Index signature is required by Vibe's BaseItemData constraint. */
export interface SelectOption extends Record<string, unknown> {
  value: string;
  label: string;
}

interface SelectBaseProps {
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Renders a search input inside the dropdown. */
  searchable?: boolean;
  clearable?: boolean;
  size?: "small" | "medium" | "large";
  className?: string;
  id?: string;
}

export interface SelectProps extends SelectBaseProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled,
  searchable = false,
  clearable = false,
  size = "small",
  className,
  id,
}: SelectProps) {
  const selected = React.useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );
  const common = {
    id,
    className,
    options,
    value: selected,
    onChange: (option: SelectOption) => onChange?.(option?.value ?? null),
    placeholder,
    disabled,
    clearable,
    size,
  };
  /* `searchable` is a literal-typed discriminator in Vibe's Dropdown
     props, so it can't be passed as a boolean expression. */
  return searchable ? (
    <Dropdown searchable {...common} />
  ) : (
    <Dropdown {...common} />
  );
}

/* Drop-in replacement for a native <select> element: accepts <option>
   children and the familiar e.target.value onChange shape, but renders a
   Vibe Dropdown. An empty-value <option> becomes the placeholder. */
export interface NativeSelectProps {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: { target: { value: string } }) => void;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  size?: "small" | "medium" | "large";
  id?: string;
}

function optionText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(optionText).join("");
  if (React.isValidElement(node)) {
    return optionText((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

export function NativeSelect({
  value,
  defaultValue,
  onChange,
  children,
  className,
  style,
  disabled,
  size = "small",
  id,
}: NativeSelectProps) {
  /* uncontrolled support: track selection locally when only defaultValue given */
  const [internal, setInternal] = React.useState<string>(
    defaultValue != null ? String(defaultValue) : ""
  );
  const controlled = value !== undefined;
  const current = controlled ? String(value) : internal;
  const options: SelectOption[] = [];
  let placeholder: string | undefined;
  React.Children.forEach(children, function walk(child) {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      React.Children.forEach(
        (child.props as { children?: React.ReactNode }).children,
        walk
      );
      return;
    }
    if (child.type !== "option") return;
    const props = child.props as {
      value?: string | number;
      children?: React.ReactNode;
      disabled?: boolean;
    };
    const v = String(props.value ?? optionText(props.children));
    if (v === "") {
      placeholder = optionText(props.children) || undefined;
      return;
    }
    options.push({ value: v, label: optionText(props.children), disabled: props.disabled });
  });

  const select = (
    <Select
      id={id}
      className={className}
      options={options}
      value={current || null}
      onChange={(v) => {
        if (!controlled) setInternal(v ?? "");
        onChange?.({ target: { value: v ?? "" } });
      }}
      placeholder={placeholder ?? "Select..."}
      clearable={placeholder !== undefined}
      disabled={disabled}
      size={size}
    />
  );
  return style ? <div style={style}>{select}</div> : select;
}

export interface MultiSelectProps extends SelectBaseProps {
  value?: string[];
  onChange?: (values: string[]) => void;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled,
  searchable = false,
  clearable = true,
  size = "small",
  className,
  id,
}: MultiSelectProps) {
  const selected = React.useMemo(
    () => options.filter((o) => value?.includes(o.value)),
    [options, value]
  );
  const common = {
    id,
    className,
    options,
    value: selected,
    onChange: (opts: SelectOption[]) =>
      onChange?.((opts ?? []).map((o) => o.value)),
    placeholder,
    disabled,
    clearable,
    size,
  };
  return searchable ? (
    <Dropdown multi searchable {...common} />
  ) : (
    <Dropdown multi {...common} />
  );
}
