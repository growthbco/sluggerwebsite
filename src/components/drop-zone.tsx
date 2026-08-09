"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";

/** Makes any upload UI a drag-and-drop target: wrap the button/label and pass
 *  the same handler the hidden file input uses. Highlights while a file is
 *  hovering. The depth counter keeps the highlight steady while dragging over
 *  child elements (dragleave fires on every child boundary). */
export function DropZone({
  onFiles,
  disabled,
  className = "",
  children,
}: {
  onFiles: (files: FileList) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  function stop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div
      onDragOver={stop}
      onDragEnter={(e) => {
        stop(e);
        depth.current++;
        if (!disabled) setOver(true);
      }}
      onDragLeave={(e) => {
        stop(e);
        if (--depth.current <= 0) {
          depth.current = 0;
          setOver(false);
        }
      }}
      onDrop={(e) => {
        stop(e);
        depth.current = 0;
        setOver(false);
        if (!disabled && e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      className={`${className} ${over ? "outline-2 outline-dashed outline-brand bg-brand/10" : ""}`.trim()}
    >
      {children}
    </div>
  );
}

/** First image file in a drop, if any (drops can include folders/other types). */
export function firstImageFile(files: FileList): File | undefined {
  return Array.from(files).find((f) => f.type.startsWith("image/"));
}
