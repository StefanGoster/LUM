import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'LUM — Design studio',description:'A private studio for ideas, layers and intentional design.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
