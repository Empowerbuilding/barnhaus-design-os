import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Barnhaus Design OS',
  description: 'Design Pipeline OS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <div style={{
          position: 'fixed',
          bottom: 4,
          right: 8,
          fontSize: 10,
          color: '#374151',
          fontFamily: 'Oswald, sans-serif',
          letterSpacing: '0.1em',
          pointerEvents: 'none',
          zIndex: 9999
        }}>
          v1.0.11
        </div>
      </body>
    </html>
  )
}
