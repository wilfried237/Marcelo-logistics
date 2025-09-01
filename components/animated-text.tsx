"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"

interface AnimatedTextProps {
  text: string
  className?: string
  delay?: number
  staggerDelay?: number
}

export function AnimatedText({ text, className = "", delay = 0, staggerDelay = 0.05 }: AnimatedTextProps) {
  const [words, setWords] = useState<string[]>([])

  useEffect(() => {
    setWords(text.split(" "))
  }, [text])

  return (
    <div className={className}>
      {words.map((word, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: delay + index * staggerDelay,
            ease: "easeOut"
          }}
          viewport={{ once: true, margin: "-100px" }}
          className="inline-block mr-2"
        >
          {word}
        </motion.span>
      ))}
    </div>
  )
} 