import { useState, useEffect } from "react";
import { Book, Menu, Sunset, Trees, Zap, X, Languages } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { motion } from "framer-motion";

interface MenuItem {
  title: string;
  url: string;
  description?: string;
  icon?: React.ReactNode;
  items?: MenuItem[];
}

interface Navbar1Props {
  logo?: {
    url: string;
    src: string;
    alt: string;
    title: string;
  };
  menu?: MenuItem[];
  auth?: {
    login: {
      title: string;
      url: string;
    };
    signup: {
      title: string;
      url: string;
    };
  };
  translations?: {
    [key: string]: {
      [key: string]: string;
    };
  };
}

const Navbar1 = ({
  logo = {
    url: "/",
    src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblockscom-icon.svg",
    alt: "Machelo Logistics",
    title: "Machelo Logistics",
  },
  menu = [
    { title: "Home", url: "/" },
    {
      title: "Services",
      url: "/#services",
      items: [
        {
          title: "Get Quote",
          description: "Clean, brand-aligned, responsive design",
          icon: <Book className="size-5 shrink-0" />,
          url: "/quote",
        },
        {
          title: "Track Shipment",
          description: "Landing pages to full digital platforms",
          icon: <Trees className="size-5 shrink-0" />,
          url: "/track",
        },
        {
          title: "Portal",
          description: "Structure, content, and promotion guidance",
          icon: <Sunset className="size-5 shrink-0" />,
          url: "/portal",
        },
        {
          title: "What we do",
          description:
            "Security, updates, and continuous improvements",
          icon: <Zap className="size-5 shrink-0" />,
          url: "/#services",
        },
      ],
    },
    {
      title: "About",
      url: "/#about",
    },
    {
      title: "Our Work",
      url: "/#work",
    },
    {
      title: "Contact",
      url: "/#contact",
    },
  ],
  auth = {
    login: { title: "Login", url: "#" },
    signup: { title: "Sign up", url: "#" },
  },
  translations = {
    en: {
      "Home": "Home",
      "Services": "Services",
      "About": "About",
      "Our Work": "Our Work",
      "Contact": "Contact",
      "Get Quote": "Get Quote",
      "Track Shipment": "Track Shipment",
      "Portal": "Portal",
      "What we do": "What we do",
      "Login": "Login",
      "Sign up": "Sign up",
      "Clean, brand-aligned, responsive design": "Clean, brand-aligned, responsive design",
      "Landing pages to full digital platforms": "Landing pages to full digital platforms",
      "Structure, content, and promotion guidance": "Structure, content, and promotion guidance",
      "Security, updates, and continuous improvements": "Security, updates, and continuous improvements"
    },
    fr: {
      "Home": "Accueil",
      "Services": "Services",
      "About": "À propos",
      "Our Work": "Nos réalisations",
      "Contact": "Contact",
      "Get Quote": "Obtenir un devis",
      "Track Shipment": "Suivre l'expédition",
      "Portal": "Portail",
      "What we do": "Ce que nous faisons",
      "Login": "Connexion",
      "Sign up": "S'inscrire",
      "Clean, brand-aligned, responsive design": "Design propre, aligné sur la marque et réactif",
      "Landing pages to full digital platforms": "Des pages de destination aux plateformes numériques complètes",
      "Structure, content, and promotion guidance": "Structure, contenu et conseils promotionnels",
      "Security, updates, and continuous improvements": "Sécurité, mises à jour et améliorations continues"
    }
  }
}: Navbar1Props) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'fr'>('en');

  // Load language preference from localStorage on component mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('preferredLanguage');
    if (savedLanguage === 'en' || savedLanguage === 'fr') {
      setCurrentLanguage(savedLanguage);
    }
  }, []);

  // Save language preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('preferredLanguage', currentLanguage);
  }, [currentLanguage]);

  const toggleLanguage = () => {
    setCurrentLanguage(prev => prev === 'en' ? 'fr' : 'en');
  };

  // Function to translate text based on current language
  const t = (key: string): string => {
    return translations[currentLanguage][key] || key;
  };

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled 
          ? "bg-background/95 backdrop-blur-md border-b border-border/40 shadow-sm" 
          : "bg-background"
      }`}
    >
      <div className="container max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center justify-between w-full">
          <div className="flex items-center gap-10">
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex items-center space-x-2"
            >
              {/* Logo */}
              <a href={logo.url} className="flex items-center gap-2">
                <img
                  src={logo.src}
                  className="h-10 w-10 dark:invert"
                  alt={logo.alt}
                />
                <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  {logo.title}
                </span>
              </a>
            </motion.div>
            
            <div className="flex items-center">
              <NavigationMenu>
                <NavigationMenuList className="gap-1">
                  {menu.map((item) => renderMenuItem(item, t))}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            {/* Language Toggle Button */}
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 font-medium"
              onClick={toggleLanguage}
            >
              <Languages className="h-4 w-4" />
              {currentLanguage === 'en' ? 'FR' : 'EN'}
            </Button>
            
            <Button asChild variant="ghost" size="sm" className="font-medium">
              <a href={auth.login.url}>{t(auth.login.title)}</a>
            </Button>
            <Button asChild size="sm" className="font-medium shadow-md">
              <a href={auth.signup.url}>{t(auth.signup.title)}</a>
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className="flex lg:hidden items-center justify-between w-full">
          {/* Logo */}
          <a href={logo.url} className="flex items-center gap-2">
            <img
              src={logo.src}
              className="h-9 w-9 dark:invert"
              alt={logo.alt}
            />
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {logo.title}
            </span>
          </a>
          
          <div className="flex items-center gap-2">
            {/* Language Toggle Button for Mobile */}
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 font-medium h-9 w-14"
              onClick={toggleLanguage}
            >
              {currentLanguage === 'en' ? 'FR' : 'EN'}
            </Button>
            
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="rounded-full h-9 w-9"
                >
                  {mobileMenuOpen ? (
                    <X className="size-5" />
                  ) : (
                    <Menu className="size-5" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto sm:max-w-md">
                <SheetHeader className="text-left pb-6 border-b">
                  <SheetTitle>
                    <a 
                      href={logo.url} 
                      className="flex items-center gap-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <img
                        src={logo.src}
                        className="h-9 w-9 dark:invert"
                        alt={logo.alt}
                      />
                      <span className="text-lg font-bold">
                        {logo.title}
                      </span>
                    </a>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-6 py-6">
                  <Accordion
                    type="single"
                    collapsible
                    className="flex w-full flex-col gap-4"
                  >
                    {menu.map((item) => renderMobileMenuItem(item, setMobileMenuOpen, t))}
                  </Accordion>

                  <div className="flex flex-col gap-3 pt-4">
                    <Button asChild variant="outline" className="font-medium">
                      <a 
                        href={auth.login.url}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {t(auth.login.title)}
                      </a>
                    </Button>
                    <Button asChild className="font-medium shadow-md">
                      <a 
                        href={auth.signup.url}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {t(auth.signup.title)}
                      </a>
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

const renderMenuItem = (item: MenuItem, t: (key: string) => string) => {
  if (item.items) {
    return (
      <NavigationMenuItem key={item.title}>
        <NavigationMenuTrigger className="font-medium text-foreground/80 hover:text-foreground data-[state=open]:text-foreground data-[state=open]:bg-accent/50 px-3 py-2 rounded-md">
          {t(item.title)}
        </NavigationMenuTrigger>
        <NavigationMenuContent className="bg-popover text-popover-foreground rounded-xl shadow-lg p-2">
          {item.items.map((subItem) => (
            <NavigationMenuLink asChild key={subItem.title} className="w-80">
              <SubMenuLink item={subItem} t={t} />
            </NavigationMenuLink>
          ))}
        </NavigationMenuContent>
      </NavigationMenuItem>
    );
  }

  return (
    <NavigationMenuItem key={item.title}>
      <NavigationMenuLink
        href={item.url}
        className="font-medium text-foreground/80 hover:text-foreground hover:bg-accent/50 group inline-flex h-10 w-max items-center justify-center rounded-md px-3 py-2 text-sm transition-colors"
      >
        {t(item.title)}
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
};

const renderMobileMenuItem = (item: MenuItem, setMobileMenuOpen: (open: boolean) => void, t: (key: string) => string) => {
  if (item.items) {
    return (
      <AccordionItem key={item.title} value={item.title} className="border-b-0">
        <AccordionTrigger className="text-md py-2 font-semibold hover:no-underline [&[data-state=open]>svg]:rotate-180">
          {t(item.title)}
        </AccordionTrigger>
        <AccordionContent className="mt-2 pl-4">
          {item.items.map((subItem) => (
            <a
              key={subItem.title}
              href={subItem.url}
              className="flex items-center gap-3 py-3 text-muted-foreground hover:text-foreground transition-colors border-b border-border/40 last:border-b-0"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="text-muted-foreground">{subItem.icon}</div>
              <div>
                <div className="text-sm font-medium">{t(subItem.title)}</div>
                {subItem.description && (
                  <p className="text-muted-foreground text-xs leading-snug mt-1">
                    {t(subItem.description)}
                  </p>
                )}
              </div>
            </a>
          ))}
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <a 
      key={item.title} 
      href={item.url} 
      className="text-md font-semibold py-2 border-b border-border/40 last:border-b-0"
      onClick={() => setMobileMenuOpen(false)}
    >
      {t(item.title)}
    </a>
  );
};

const SubMenuLink = ({ item, t }: { item: MenuItem, t: (key: string) => string }) => {
  return (
    <a
      className="flex min-w-80 select-none flex-row gap-4 rounded-lg p-3 leading-none no-underline outline-none transition-colors hover:bg-accent/50"
      href={item.url}
    >
      <div className="text-primary">{item.icon}</div>
      <div>
        <div className="text-sm font-medium">{t(item.title)}</div>
        {item.description && (
          <p className="text-muted-foreground text-sm leading-snug mt-1">
            {t(item.description)}
          </p>
        )}
      </div>
    </a>
  );
};

export { Navbar1 };