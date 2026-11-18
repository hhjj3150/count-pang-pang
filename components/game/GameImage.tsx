"use client"
import React, { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/* ------------------------ 이미지 (폴백 포함) ------------------------ */
export function GameImage({
  src,
  alt,
  fallback,
  className,
  style,
}: {
  src: string
  alt: string
  fallback: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const [err, setErr] = useState(false)
  useEffect(() => setErr(false), [src])
  if (!err && src) {
    return (
      <img
        src={src || "/placeholder.svg"}
        alt={alt}
        className={className}
        style={style}
        draggable={false}
        onError={() => setErr(true)}
      />
    )
  }
  return (
    <div
      className={cn(className, "flex items-center justify-center leading-none select-none overflow-hidden")}
      style={style}
      role="img"
      aria-label={alt}
    >
      {fallback}
    </div>
  )
}
