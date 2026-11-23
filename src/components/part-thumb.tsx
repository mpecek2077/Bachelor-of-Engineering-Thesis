"use client";

import { useState } from "react";

type PartThumbProps = {
  src?: string | null;
  alt?: string;
  className?: string;
};

export function PartThumb({ src, alt = "", className = "" }: PartThumbProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const failed = Boolean(src) && failedSrc === src;
  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={`part-thumb ${className}`.trim()}
      aria-hidden={alt ? undefined : true}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={alt}
          loading="lazy"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        <span>Brak zdjęcia</span>
      )}
    </div>
  );
}
