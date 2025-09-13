"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { LucideIcon, ChevronDown, Menu} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export interface NavigationItem {
  label: string
  href?: string
  children?: NavigationItem[]
}

export interface NavigationProps {
  logo: {
    icon: LucideIcon
    text: string
  }
  navigationItems: NavigationItem[]
  ctaButton: {
    text: string
    onClick?: () => void
    href?: string
  }
  className?: string
}

export function Navigation({
  logo,
  navigationItems,
  ctaButton,
  className = ""
}: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <motion.nav 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={`fixed mx-auto top-0 w-full bg-background/80 backdrop-blur-sm z-50 ${className}`}
    >
      <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <motion.div 
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center space-x-2"
        >
          <logo.icon className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold">{logo.text}</span>
        </motion.div>
        
        {/* Desktop Navigation */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="hidden md:flex items-center space-x-8"
        >
          {navigationItems.map((item, index) => (
            <div key={index}>
              {item.children ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1 hover:cursor-pointer">
                      {item.label}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {item.children.map((child, childIndex) => (
                      <DropdownMenuItem key={childIndex} asChild>
                        <a href={child.href} className="cursor-pointer active:border-none">
                          {child.label}
                        </a>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <a 
                  href={item.href} 
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  {item.label}
                </a>
              )}
            </div>
          ))}
        </motion.div>
        
        {/* Desktop CTA Button */}
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="hidden md:block"
        >
          {ctaButton.href ? (
            <Button asChild size="sm">
              <a href={ctaButton.href}>{ctaButton.text}</a>
            </Button>
          ) : (
            <Button size="sm" onClick={ctaButton.onClick}>
              {ctaButton.text}
            </Button>
          )}
        </motion.div>

        {/* Mobile Menu */}
        <div className="md:hidden">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="p-2">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[320px] sm:w-[400px] p-0">

              <div className="flex flex-col h-full">
                {/* Header */}
                <SheetHeader>
                <SheetTitle>{logo.text}</SheetTitle>
                <SheetDescription>Navigate our services</SheetDescription>
                </SheetHeader>

                 {/* Navigation Content */}
                 <div className="flex-1 px-6 py-6 overflow-y-auto">
                   <nav className="space-y-4">
                     {navigationItems.map((item, index) => (
                       <div key={index}>
                         {item.children ? (
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <button className="flex items-center justify-between w-full px-3 py-3 text-left text-base font-medium hover:text-primary transition-colors rounded-lg hover:bg-muted/50">
                                 <span>{item.label}</span>
                                 <ChevronDown className="h-4 w-4" />
                               </button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="start" className="w-56">

                               {item.children.map((child, childIndex) => (
                                 <DropdownMenuItem key={childIndex} asChild>
                                   <a 
                                     href={child.href} 
                                     className="cursor-pointer"
                                     onClick={() => setIsOpen(false)}
                                   >
                                     {child.label}
                                   </a>
                                 </DropdownMenuItem>
                               ))}
                             </DropdownMenuContent>
                           </DropdownMenu>
                         ) : (
                           <a
                             href={item.href}
                             className="block px-3 py-3 text-base font-medium hover:text-primary transition-colors rounded-lg hover:bg-muted/50"
                             onClick={() => setIsOpen(false)}
                           >
                             {item.label}
                           </a>
                         )}
                       </div>
                     ))}
                   </nav>
                 </div>

                {/* Footer with CTA */}
                <div className="px-6 py-6 border-t bg-muted/30">
                  <div className="space-y-3">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-2">Ready to get started?</p>
                    </div>
                    {ctaButton.href ? (
                      <Button asChild className="w-full h-11 text-sm font-semibold">
                        <a href={ctaButton.href} onClick={() => setIsOpen(false)}>
                          {ctaButton.text}
                        </a>
                      </Button>
                    ) : (
                      <Button 
                        className="w-full h-11 text-sm font-semibold" 
                        onClick={() => {
                          ctaButton.onClick?.()
                          setIsOpen(false)
                        }}
                      >
                        {ctaButton.text}
                      </Button>
                    )}
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">
                        Need help? Contact our support team
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.nav>
  )
}
