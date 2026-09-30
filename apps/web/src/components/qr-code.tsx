'use client';

import { encode } from 'uqr';

/**
 * A QR code drawn as one SVG path, generated in the browser (the value, e.g. an authenticator
 * secret, never leaves the page).
 */
export function QrCode({
  value,
  label,
  size = 200,
}: {
  value: string;
  label: string;
  size?: number;
}) {
  const { data } = encode(value, { border: 2 });
  const cells = data.length;
  let path = '';
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${cells} ${cells}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="bg-white"
    >
      <path d={path} fill="black" />
    </svg>
  );
}
