import type { ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  delay?: number
  className?: string
}

export default function Reveal({ children, className }: RevealProps) {
  return <div className={className}>{children}</div>
}

export function RevealStagger({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}

export function RevealChild({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}
