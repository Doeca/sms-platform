"use client";

import { useState } from "react";
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
  const activeLabel = getReadStateLabel(readState);
  const buttonLabel = readState === "all" ? "筛选" : `筛选 ${activeLabel}`;

  function handleChange(nextReadState: ClientReadState) {
    onChange(nextReadState);
    setOpen(false);
  }

  return (
    <div className="read-filter">
      <button
        aria-expanded={open}
        className="toolbar-button"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <SlidersHorizontal size={16} />
        {buttonLabel}
      </button>

      {open ? (
        <div
          aria-label="已读状态筛选"
          className="read-filter__menu"
          role="menu"
        >
          {readStateOptions.map(([value, label]) => (
            <button
              aria-checked={readState === value}
              className="read-filter__option"
              key={value}
              onClick={() => handleChange(value)}
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
