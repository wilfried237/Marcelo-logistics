"use client"
import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <>
      <style jsx global>{`
        .navbar, 
        nav, 
        header[role="banner"],
        [data-navbar],
        .main-nav,
        .site-header {
          display: none !important;
          visibility: hidden !important;
        }
        
        body {
          margin: 0;
          padding: 0;
        }
      `}</style>
      <div className="auth-layout">
        <main className="min-h-screen w-full">
          {children}
        </main>
      </div>
    </>
  );
}