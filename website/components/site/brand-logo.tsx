import Image from "next/image"

export function BrandLogo() {
  return (
    <Image
      src="/smartmove-logo.svg"
      alt=""
      width={36}
      height={40}
      className="smartmove-brand-mark"
      unoptimized
    />
  )
}
