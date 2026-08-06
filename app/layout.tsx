import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Barnhaus Design OS',
  description: 'Design Pipeline OS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
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
          v1.0.15
        </div>
      </body>
    </html>
  )
}
