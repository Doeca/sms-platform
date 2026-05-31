"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { ClientReadState } from "@/client/api";

const readStateOptions = [
  ["all", "全部"],
  ["unread", "未读"],
  ["read", "已读"]
] as const satisfies ReadonlyArray<readonly [ClientReadState, string]>;

type ReadFilterMenuProps = {
  readState: ClientReadState;
  onChange: (readState: ClientReadState) => void;
};

function getReadStateLabel(readState: ClientReadState) {
  return readStateOptions.find(([value]) => value === readState)?.[1] ?? "全部";
}

export function ReadFilterMenu({ readState, onChange }: ReadFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeLabel = getReadStateLabel(readState);
  const buttonLabel = readState === "all" ? "筛选" : `筛选 ${activeLabel}`;
  const activeIndex = Math.max(
    readStateOptions.findIndex(([value]) => value === readState),
    0
  );

  useEffect(() => {
    if (open) {
      optionRefs.current[activeIndex]?.focus();
    }
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnOutsideInteraction(event: PointerEvent | FocusEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        !containerRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideInteraction);
    document.addEventListener("focusin", closeOnOutsideInteraction);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideInteraction);
      document.removeEventListener("focusin", closeOnOutsideInteraction);
    };
  }, [open]);

  function handleChange(nextReadState: ClientReadState) {
    onChange(nextReadState);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function focusOption(index: number) {
    optionRefs.current[index]?.focus();
  }

  function getFocusedOptionIndex() {
    const focusedIndex = optionRefs.current.findIndex(
      (option) => option === document.activeElement
    );

    return focusedIndex === -1 ? activeIndex : focusedIndex;
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        focusOption((getFocusedOptionIndex() + 1) % readStateOptions.length);
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        focusOption(
          (getFocusedOptionIndex() - 1 + readStateOptions.length) %
            readStateOptions.length
        );
        break;
      }
      case "Home": {
        event.preventDefault();
        focusOption(0);
        break;
      }
      case "End": {
        event.preventDefault();
        focusOption(readStateOptions.length - 1);
        break;
      }
      case "Escape": {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      }
    }
  }

  return (
    <div className="read-filter" ref={containerRef}>
      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        className="toolbar-button"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <SlidersHorizontal size={16} />
        {buttonLabel}
      </button>

      {open ? (
        <div
          aria-label="已读状态筛选"
          className="read-filter__menu"
          id={menuId}
          role="menu"
        >
          {readStateOptions.map(([value, label], index) => (
            <button
              aria-checked={readState === value}
              className="read-filter__option"
              key={value}
              onClick={() => handleChange(value)}
              onKeyDown={handleOptionKeyDown}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              role="menuitemradio"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
