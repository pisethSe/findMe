import Link from "next/link";

export function BrandMark() {
  return (
    <Link className="brand-mark" href="/" aria-label="FindMe home">
      <span className="brand-symbol" aria-hidden="true">
        <span />
      </span>
      <span>findMe</span>
    </Link>
  );
}
