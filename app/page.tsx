"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ArrowRight, Truck, Globe, Clock, Shield, Users, Award } from "lucide-react"
import { Contact2 } from "@/components/contact2"
import { Testimonials } from "@/components/testimonials"
import { Footer2 } from "@/components/footer"
import { AnimatedText } from "@/components/animated-text"
import { AnimatedSection } from "@/components/animated-section"
import { AnimatedCard } from "@/components/animated-card"
import { motion } from "framer-motion"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="fixed mx-auto top-0 w-full bg-background/80 backdrop-blur-sm z-50"
      >
        <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <motion.div 
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-center space-x-2"
          >
            <Truck className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Marchelo Logistics</span>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="hidden md:flex items-center space-x-8"
          >
            <a href="#about" className="text-sm font-medium hover:text-primary transition-colors">About</a>
            <a href="#services" className="text-sm font-medium hover:text-primary transition-colors">Services</a>
            <a href="#work" className="text-sm font-medium hover:text-primary transition-colors">Our Work</a>
            <a href="#contact" className="text-sm font-medium hover:text-primary transition-colors">Contact</a>
          </motion.div>
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Button size="sm">Get Quote</Button>
          </motion.div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.8 }}
              className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
            >
              <AnimatedText 
                text="Your trusted partner for global logistics" 
                className="text-5xl md:text-7xl font-bold tracking-tight"
                delay={1.2}
                staggerDelay={0.1}
              />
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.5 }}
              className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
            >
              Marchelo Logistics delivers expert shipping and logistics solutions, creating seamless supply chains with quality service and global reach.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button size="lg" className="text-lg px-8 py-6">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                View Services
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <AnimatedSection direction="up" delay={0.2}>
        <section className="py-16 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { number: "15+", label: "Years Experience" },
                { number: "50+", label: "Countries Served" },
                { number: "1000+", label: "Shipments Delivered" },
                { number: "99%", label: "Client Satisfaction" }
              ].map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.05 }}
                  className="cursor-pointer"
                >
                  <div className="text-3xl font-semibold mb-2">{stat.number}</div>
                  <div className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* About Section */}
      <AnimatedSection direction="left" delay={0.3}>
        <section id="about" className="py-20 px-4 container mx-auto max-w-7xl">
          <div className="container mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                viewport={{ once: true }}
              >
                <h2 className="text-3xl font-bold tracking-tight mb-4">About us</h2>
                <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Global logistics specialists</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                  Welcome to Marchelo Logistics, your trusted global logistics experts, dedicated to connecting businesses worldwide with precision and care. With years of experience in international shipping, customs clearance, and supply chain management, we take pride in delivering top-quality service and a seamless customer experience.
                </p>
                <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                  Our mission is to bring your cargo safely to its destination while ensuring clear communication and expert guidance at every step. Let&apos;s create a logistics solution you can trust!
                </p>
                <Button size="lg">
                  Learn More
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
                className="bg-muted/50 aspect-square rounded-2xl flex items-center justify-center cursor-pointer"
              >
                <div className="text-center text-muted-foreground">
                  <Globe className="h-16 w-16 mx-auto mb-4" />
                  <p>Global Network Image</p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Services Section */}
      <AnimatedSection direction="up" delay={0.4}>
        <section id="services" className="py-20 bg-muted/30 px-4">
          <div className="container mx-auto mx-auto max-w-7xl">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl font-bold tracking-tight mb-4">Services</h2>
              <h3 className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">What we do</h3>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                Find out which one of our services fits the needs of your shipment
              </p>
            </motion.div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: Truck,
                  title: "Freight Forwarding",
                  description: "Comprehensive freight forwarding services for air, sea, and land transportation. We handle everything from documentation to customs clearance, ensuring your cargo reaches its destination efficiently and on time."
                },
                {
                  icon: Shield,
                  title: "Customs Clearance",
                  description: "Expert customs clearance services to navigate complex international regulations. Our experienced team ensures smooth processing and compliance with all import/export requirements."
                },
                {
                  icon: Clock,
                  title: "Express Shipping",
                  description: "Fast and reliable express shipping solutions for time-sensitive cargo. We offer guaranteed delivery times and real-time tracking for your peace of mind."
                },
                {
                  icon: Users,
                  title: "Supply Chain Management",
                  description: "End-to-end supply chain management services to optimize your logistics operations. From warehousing to distribution, we streamline your entire process."
                },
                {
                  icon: Award,
                  title: "Project Cargo",
                  description: "Specialized handling for oversized and heavy project cargo. Our expertise in complex logistics ensures safe and timely delivery of your most challenging shipments."
                },
                {
                  icon: Globe,
                  title: "International Trade",
                  description: "Complete international trade solutions including documentation, compliance, and market access. We help you navigate global markets with confidence."
                }
              ].map((service, index) => (
                <AnimatedCard key={index} index={index} delay={0.2}>
                  <div className="bg-background p-8 rounded-2xl border-0 shadow-lg h-full">
                    <service.icon className="h-10 w-10 text-primary mb-6" />
                    <h4 className="text-xl font-semibold mb-4">{service.title}</h4>
                    <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                </AnimatedCard>
              ))}
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Our Work Section */}
      <AnimatedSection direction="right" delay={0.5}>
        <section id="work" className="py-20 px-4 container mx-auto max-w-7xl">
          <div className="container mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl font-bold tracking-tight mb-4">Our work</h2>
              <h3 className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Get inspired by our work</h3>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                See how we&apos;ve connected businesses worldwide with our expert logistics and attention to detail.
              </p>
            </motion.div>
            
            <div className="grid lg:grid-cols-2 gap-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
                className="bg-muted/50 aspect-video rounded-2xl flex items-center justify-center cursor-pointer"
              >
                <div className="text-center text-muted-foreground">
                  <Truck className="h-16 w-16 mx-auto mb-4" />
                  <p>Project Case Study Image</p>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                viewport={{ once: true }}
                className="flex flex-col justify-center"
              >
                <h4 className="text-2xl font-semibold mb-4">Global Supply Chain Optimization</h4>
                <p className="text-muted-foreground mb-6">
                  This logistics transformation brought seamless connectivity and enhanced efficiency to our client&apos;s global operations. We implemented custom routing, real-time tracking, and optimized customs processes, creating a reliable and cost-effective supply chain perfect for international trade.
                </p>
                <div className="flex items-center gap-4 mb-6">
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">Logistics</span>
                  <span className="text-muted-foreground">6 months</span>
                </div>
                <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground">
                &quot;Marchelo Logistics completely transformed our supply chain, making it both efficient and highly reliable. The service was outstanding, and the team was professional and communicative throughout. We couldn&apos;t be happier with the result!&quot;
                </blockquote>
                <p className="font-semibold mt-4">Sarah Johnson - Global Operations Manager</p>
              </motion.div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Testimonials Section */}
      <AnimatedSection direction="up" delay={0.6}>
        <section className="py-20 bg-muted/30 px-4">
          <Testimonials />
        </section>
      </AnimatedSection>

      {/* Contact Section */}
      <AnimatedSection direction="up" delay={0.7}>
        <section id="contact" className="py-20 px-4">
          <Contact2 />
        </section>
      </AnimatedSection>

      {/* Footer */}
      <AnimatedSection direction="up" delay={0.8}>
        <footer className="bg-muted/50 py-12 px-4">
          <Footer2 />
      </footer>
      </AnimatedSection>
    </div>
  )
}
