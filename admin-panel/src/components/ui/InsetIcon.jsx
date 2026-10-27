// Places a Figma "Vector" export inside its fixed-size parent at the exact offsets used in the design.
export default function InsetIcon({ src, size, inset, bleed }) {
  const [top, right, bottom, left] = inset
  const [bleedY, bleedX] = bleed

  return (
    <span className="relative block shrink-0 overflow-clip" style={{ width: size, height: size }} aria-hidden="true">
      <span className="absolute" style={{ top: `${top}%`, right: `${right}%`, bottom: `${bottom}%`, left: `${left}%` }}>
        <span
          className="absolute"
          style={{ top: `${bleedY}%`, right: `${bleedX}%`, bottom: `${bleedY}%`, left: `${bleedX}%` }}
        >
          <img src={src} alt="" className="block size-full max-w-none" />
        </span>
      </span>
    </span>
  )
}
