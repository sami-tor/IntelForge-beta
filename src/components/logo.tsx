/**
 * IntelForge Logo
 *
 * Design rationale:
 * - Hexagon base: represents data structures, security, technical depth
 * - "IF" monogram: IntelForge identity, clean and memorable
 * - Circuit/node elements: intelligence processing, OSINT
 * - Shield hint: protection, threat intelligence
 * - Red primary color: brand consistency
 * - Scalable: works from 16px favicon to large display
 */
import type { SVGProps } from "react"

interface LogoProps extends SVGProps<SVGSVGElement> {
  variant?: "icon" | "full" | "wordmark"
  size?: "sm" | "md" | "lg"
}

const sizeMap = {
  sm: { icon: 24, word: 14, height: 28 },
  md: { icon: 32, word: 18, height: 36 },
  lg: { icon: 48, word: 24, height: 56 },
}

export default function Logo({ variant = "full", size = "md", className = "", ...props }: LogoProps) {
  const dims = sizeMap[size] || sizeMap.md

  if (variant === "icon") {
    return (
      <svg
        width={dims.icon}
        height={dims.icon}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
      >
        {/* Hexagon base with gradient feel */}
        <path
          d="M32 4 L56 18 L56 46 L32 60 L8 46 L8 18 Z"
          fill="var(--primary)"
          opacity="0.12"
        />
        <path
          d="M32 8 L52 20 L52 44 L32 56 L12 44 L12 20 Z"
          stroke="var(--primary)"
          strokeWidth="2"
          fill="none"
          strokeLinejoin="round"
        />

        {/* "IF" monogram */}
        <text
          x="32"
          y="40"
          textAnchor="middle"
          fontFamily="oxanium, sans-serif"
          fontWeight="700"
          fontSize="22"
          fill="var(--primary)"
          letterSpacing="-1"
        >
          IF
        </text>

        {/* Circuit nodes at hexagon corners */}
        <circle cx="32" cy="8" r="3" fill="var(--primary)" />
        <circle cx="32" cy="56" r="3" fill="var(--primary)" />
        <circle cx="52" cy="20" r="2.5" fill="var(--primary)" opacity="0.7" />
        <circle cx="52" cy="44" r="2.5" fill="var(--primary)" opacity="0.7" />
        <circle cx="12" cy="20" r="2.5" fill="var(--primary)" opacity="0.7" />
        <circle cx="12" cy="44" r="2.5" fill="var(--primary)" opacity="0.7" />

        {/* Small circuit lines */}
        <line x1="32" y1="11" x2="32" y2="15" stroke="var(--primary)" strokeWidth="1.5" opacity="0.5" />
        <line x1="32" y1="49" x2="32" y2="53" stroke="var(--primary)" strokeWidth="1.5" opacity="0.5" />
      </svg>
    )
  }

  if (variant === "wordmark") {
    return (
      <svg
        height={dims.word * 2}
        viewBox="0 0 200 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
      >
        {/* "Intel" in muted foreground */}
        <text
          x="10"
          y="28"
          fontFamily="oxanium, sans-serif"
          fontWeight="600"
          fontSize="22"
          fill="var(--foreground)"
          letterSpacing="0.5"
        >
          Intel
        </text>
        {/* "Forge" in primary */}
        <text
          x="82"
          y="28"
          fontFamily="oxanium, sans-serif"
          fontWeight="700"
          fontSize="22"
          fill="var(--primary)"
          letterSpacing="0.5"
        >
          Forge
        </text>
      </svg>
    )
  }

  // Full variant: icon + wordmark
  return (
    <svg
      height={dims.height}
      viewBox="0 0 240 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Hexagon icon */}
      <g transform="translate(4, -4)">
        {/* Hexagon fill */}
        <path
          d="M24 6 L42 14 L42 30 L24 38 L6 30 L6 14 Z"
          fill="var(--primary)"
          opacity="0.1"
        />
        {/* Hexagon border */}
        <path
          d="M24 8 L40 15 L40 29 L24 36 L8 29 L8 15 Z"
          stroke="var(--primary)"
          strokeWidth="1.5"
          fill="none"
          strokeLinejoin="round"
        />

        {/* "IF" monogram */}
        <text
          x="24"
          y="27"
          textAnchor="middle"
          fontFamily="oxanium, sans-serif"
          fontWeight="700"
          fontSize="16"
          fill="var(--primary)"
        >
          IF
        </text>

        {/* Circuit nodes */}
        <circle cx="24" cy="8" r="2" fill="var(--primary)" />
        <circle cx="24" cy="36" r="2" fill="var(--primary)" />
        <circle cx="40" cy="15" r="1.5" fill="var(--primary)" opacity="0.6" />
        <circle cx="40" cy="29" r="1.5" fill="var(--primary)" opacity="0.6" />
        <circle cx="8" cy="15" r="1.5" fill="var(--primary)" opacity="0.6" />
        <circle cx="8" cy="29" r="1.5" fill="var(--primary)" opacity="0.6" />
      </g>

      {/* Divider line */}
      <line x1="56" y1="14" x2="56" y2="42" stroke="var(--border)" strokeWidth="1" />

      {/* Wordmark */}
      <text
        x="68"
        y="33"
        fontFamily="oxanium, sans-serif"
        fontWeight="600"
        fontSize="20"
        fill="var(--foreground)"
        letterSpacing="0.5"
      >
        Intel
      </text>
      <text
        x="134"
        y="33"
        fontFamily="oxanium, sans-serif"
        fontWeight="700"
        fontSize="20"
        fill="var(--primary)"
        letterSpacing="0.5"
      >
        Forge
      </text>
    </svg>
  )
}
