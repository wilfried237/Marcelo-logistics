"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star } from "lucide-react"
import { motion } from "framer-motion"

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Product Manager",
    company: "TechCorp",
    image: "/avatars/sarah.jpg",
    content: "This product has completely transformed how we handle our daily operations. The efficiency gains are remarkable, and the user interface is intuitive. Highly recommended for any team looking to streamline their workflow.",
    rating: 5,
    badge: "Verified Customer"
  },
  {
    name: "Michael Rodriguez",
    role: "Senior Developer",
    company: "DevStudio",
    image: "/avatars/michael.jpg",
    content: "The integration was seamless and the support team was incredibly helpful throughout the process. The features are exactly what we needed to scale our development workflow.",
    rating: 5,
    badge: "Verified Customer"
  },
  {
    name: "Emily Watson",
    role: "Marketing Director",
    company: "GrowthCo",
    image: "/avatars/emily.jpg",
    content: "We've seen a 40% increase in productivity since implementing this solution. The analytics and reporting features provide valuable insights that help us make data-driven decisions.",
    rating: 5,
    badge: "Verified Customer"
  },
  {
    name: "David Kim",
    role: "CTO",
    company: "StartupXYZ",
    image: "/avatars/david.jpg",
    content: "As a growing startup, we needed a solution that could scale with us. This platform has exceeded our expectations and continues to deliver value as we expand.",
    rating: 5,
    badge: "Verified Customer"
  },
  {
    name: "Lisa Thompson",
    role: "Operations Manager",
    company: "Enterprise Inc",
    image: "/avatars/lisa.jpg",
    content: "The automation features have saved us countless hours. The team was responsive to our custom requirements and delivered a solution that perfectly fits our needs.",
    rating: 5,
    badge: "Verified Customer"
  },
  {
    name: "James Wilson",
    role: "Project Lead",
    company: "Innovation Labs",
    image: "/avatars/james.jpg",
    content: "Outstanding performance and reliability. The platform has become an essential part of our project management toolkit. The customer service is exceptional.",
    rating: 5,
    badge: "Verified Customer"
  }
]

export function Testimonials() {
  return (
    <section className="py-16 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 mx-auto max-w-7xl justify-between gap-10 lg:gap-20">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Loved by teams worldwide
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            See what our customers have to say about their experience with our platform.
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.6,
                delay: index * 0.1,
                ease: "easeOut"
              }}
              viewport={{ once: true, margin: "-50px" }}
              whileHover={{ 
                y: -5, 
                scale: 1.02,
                transition: { duration: 0.2 }
              }}
            >
              <Card className="border-0 shadow-lg h-full">
                <CardContent className="p-6">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: index * 0.1 + 0.2 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-1 mb-4"
                  >
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </motion.div>
                  
                  <motion.p 
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
                    viewport={{ once: true }}
                    className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed"
                  >
                    &quot;{testimonial.content}&quot;
                  </motion.p>
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 + 0.4 }}
                    viewport={{ once: true }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={testimonial.image} alt={testimonial.name} />
                        <AvatarFallback>
                          {testimonial.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-sm">{testimonial.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {testimonial.role} at {testimonial.company}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {testimonial.badge}
                    </Badge>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
} 