import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/AuthProvider'
import '@/app/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'RelevantSee — AI Marketing Campaign Copilot',
  description: 'AI-powered marketing campaign creation, brand scoring, and approval workflow.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-white antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}