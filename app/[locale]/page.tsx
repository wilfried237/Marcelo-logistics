"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, Truck, Globe, Clock, Shield, Users, Award } from "lucide-react"
import { Contact2 } from "@/components/contact2"
import { Testimonials } from "@/components/testimonials"
import { Footer2 } from "@/components/footer"
import { AnimatedText } from "@/components/animated-text"
import { AnimatedSection } from "@/components/animated-section"
import { AnimatedCard } from "@/components/animated-card"
import { motion } from "framer-motion"
import Work from "@/public/work1.jpeg";
import Work2 from "@/public/work2.jpeg";
import Image from "next/image"
import { useTranslations } from 'next-intl'

export default function LandingPage() {
  const t = useTranslations()

return (
    <div className="min-h-screen bg-background">
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
                text={t('hero.title')}
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
              {t('hero.subtitle')}
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button size="lg" className="text-lg px-8 py-6">
                {t('hero.buttons.getStarted')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                {t('hero.buttons.viewServices')}
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
                { number: t('stats.experience.number'), label: t('stats.experience.label') },
                { number: t('stats.countries.number'), label: t('stats.countries.label') },
                { number: t('stats.shipments.number'), label: t('stats.shipments.label') },
                { number: t('stats.satisfaction.number'), label: t('stats.satisfaction.label') }
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
                <h2 className="text-3xl font-bold tracking-tight mb-4">{t('about.heading')}</h2>
                <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">{t('about.subheading')}</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                  {t('about.paragraph1')}
                </p>
                <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                  {t('about.paragraph2')}
                </p>
                <Button size="lg">
                  {t('about.learnMoreButton')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                viewport={{ once: true }}
                className="bg-muted/50 aspect-square rounded-2xl flex items-center justify-center cursor-pointer"
              >
                <Image
                  alt={t('common.imageAlt')}
                  src={Work}
                  className="h-full w-full aspect-square rounded-2xl object-cover"
                />
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
              <h2 className="text-3xl font-bold tracking-tight mb-4">{t('services.heading')}</h2>
              <h3 className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">{t('services.subheading')}</h3>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                {t('services.description')}
              </p>
            </motion.div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: Truck,
                  title: t('services.items.freightForwarding.title'),
                  description: t('services.items.freightForwarding.description')
                },
                {
                  icon: Shield,
                  title: t('services.items.customsClearance.title'),
                  description: t('services.items.customsClearance.description')
                },
                {
                  icon: Clock,
                  title: t('services.items.expressShipping.title'),
                  description: t('services.items.expressShipping.description')
                },
                {
                  icon: Users,
                  title: t('services.items.supplyChainManagement.title'),
                  description: t('services.items.supplyChainManagement.description')
                },
                {
                  icon: Award,
                  title: t('services.items.projectCargo.title'),
                  description: t('services.items.projectCargo.description')
                },
                {
                  icon: Globe,
                  title: t('services.items.internationalTrade.title'),
                  description: t('services.items.internationalTrade.description')
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
              <h2 className="text-3xl font-bold tracking-tight mb-4">{t('work.heading')}</h2>
              <h3 className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">{t('work.subheading')}</h3>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                {t('work.description')}
              </p>
            </motion.div>
            
            <div className="grid lg:grid-cols-2 gap-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                viewport={{ once: true }}
                className="bg-muted/50 aspect-video rounded-2xl flex items-center justify-center cursor-pointer"
              >
                <Image
                  alt={t('common.imageAlt')}
                  src={Work2}
                  className="h-full w-full aspect-square rounded-2xl object-cover"
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                viewport={{ once: true }}
                className="flex flex-col justify-center"
              >
                <h4 className="text-2xl font-semibold mb-4">{t('work.caseStudy.title')}</h4>
                <p className="text-muted-foreground mb-6">
                  {t('work.caseStudy.description')}
                </p>
                <div className="flex items-center gap-4 mb-6">
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">{t('work.caseStudy.category')}</span>
                  <span className="text-muted-foreground">{t('work.caseStudy.duration')}</span>
                </div>
                <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground">
                &quot;{t('work.caseStudy.testimonial.quote')}&quot;
                </blockquote>
                <p className="font-semibold mt-4">{t('work.caseStudy.testimonial.author')}</p>
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