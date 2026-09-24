"use client";

import {
  Children,
  isValidElement,
  useRef,
  useState,
  type SelectHTMLAttributes,
  type ReactElement,
} from "react";
import styles from "./rentme.module.css";

type OptionProps = {
  value: string | number;
  children: string;
  disabled?: boolean;
};

/** Native keyboard/touch selection with an optional pointer-hover menu. */
export function HoverSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const select = useRef<HTMLSelectElement>(null);
  const [open, setOpen] = useState(false);
  const options = Children.toArray(props.children).filter(
    (child): child is ReactElement<OptionProps> =>
      isValidElement<OptionProps>(child) && child.type === "option",
  );
  return (
    <div
      className={styles.hoverSelect}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          select.current?.focus();
        }
      }}
    >
      <select {...props} ref={select} onPointerDown={() => setOpen(false)} />
      {open && !props.disabled ? (
        <div className={styles.hoverOptions}>
          {options.map((option) => (
            <button
              key={String(option.props.value)}
              type="button"
              disabled={option.props.disabled}
              onClick={() => {
                const element = select.current;
                if (!element) return;
                // Dispatch a native change so controlled values and browser form semantics agree.
                Object.getOwnPropertyDescriptor(
                  HTMLSelectElement.prototype,
                  "value",
                )?.set?.call(element, String(option.props.value));
                element.dispatchEvent(new Event("change", { bubbles: true }));
                setOpen(false);
                element.focus();
              }}
            >
              {option.props.children}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
