"use client"

import { Book, Menu, Sunset, Trees, Zap } from "lucide-react";

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
import {useTranslations} from 'next-intl';
import { LanguageSwitcher } from '@/components/language-switcher';

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
}

const Navbar1 = ({
  logo,
  menu,
  auth,
}: Navbar1Props) => {
  const t = useTranslations('navigation');
  
  // Use translations with fallbacks to original structure
  const logoData = logo || {
    url: "/",
    src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblockscom-icon.svg",
    alt: t('logo.alt'),
    title: t('logo.title'),
  };

  const menuData = menu || [
    { title: t('menu.home'), url: "/" },
    {
      title: t('menu.services'),
      url: "/#services",
      items: [
        {
          title: t('subMenu.getQuote.title'),
          description: t('subMenu.getQuote.description'),
          icon: <Book className="size-5 shrink-0" />,
          url: "/quote",
        },
        {
          title: t('subMenu.trackShipment.title'),
          description: t('subMenu.trackShipment.description'),
          icon: <Trees className="size-5 shrink-0" />,
          url: "/track",
        },
        {
          title: t('subMenu.portal.title'),
          description: t('subMenu.portal.description'),
          icon: <Sunset className="size-5 shrink-0" />,
          url: "/portal",
        },
        {
          title: t('subMenu.whatWeDo.title'),
          description: t('subMenu.whatWeDo.description'),
          icon: <Zap className="size-5 shrink-0" />,
          url: "/#services",
        },
      ],
    },
    {
      title: t('menu.about'),
      url: "/#about",
    },
    {
      title: t('menu.ourWork'),
      url: "/#work",
    },
    {
      title: t('menu.contact'),
      url: "/#contact",
    },
  ];

  const authData = auth || {
    login: { title: t('auth.login'), url: "#" },
    signup: { title: t('auth.signup'), url: "#" },
  };

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">

        <div className="container">
          {/* Desktop Menu */}
          <nav className="hidden justify-between lg:flex">


            <div className="flex items-center gap-6">
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex items-center space-x-2"
              >
                {/* Logo */}
                <a href={logoData.url} className="flex items-center gap-2">
                  <img
                    src={logoData.src}
                    className="max-h-8 dark:invert"
                    alt={logoData.alt}
                  />
                  <span className="text-lg font-semibold tracking-tighter">
                    {logoData.title}
                  </span>
                </a>
              </motion.div>
              <div className="flex items-center">
                <NavigationMenu>
                  <NavigationMenuList>
                    {menuData.map((item) => renderMenuItem(item))}
                  </NavigationMenuList>
                </NavigationMenu>
              </div>
            </div>


            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <Button asChild variant="outline" size="sm">
                <a href={authData.login.url}>{authData.login.title}</a>
              </Button>
              <Button asChild size="sm">
                <a href={authData.signup.url}>{authData.signup.title}</a>
              </Button>
            </div>
          </nav>

          {/* Mobile Menu */}
          <div className="block lg:hidden">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <a href={logoData.url} className="flex items-center gap-2">
                <img
                  src={logoData.src}
                  className="max-h-8 dark:invert"
                  alt={logoData.alt}
                />
              </a>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Menu className="size-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>
                      <a href={logoData.url} className="flex items-center gap-2">
                        <img
                          src={logoData.src}
                          className="max-h-8 dark:invert"
                          alt={logoData.alt}
                        />
                      </a>
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-6 p-4">
                    <Accordion
                      type="single"
                      collapsible
                      className="flex w-full flex-col gap-4"
                    >
                      {menuData.map((item) => renderMobileMenuItem(item))}
                    </Accordion>

                    <div className="flex flex-col gap-3">
                      <LanguageSwitcher />
                      <Button asChild variant="outline">
                        <a href={authData.login.url}>{authData.login.title}</a>
                      </Button>
                      <Button asChild>
                        <a href={authData.signup.url}>{authData.signup.title}</a>
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

const renderMenuItem = (item: MenuItem) => {
  if (item.items) {
    return (
      <NavigationMenuItem key={item.title}>
        <NavigationMenuTrigger>{item.title}</NavigationMenuTrigger>
        <NavigationMenuContent className="bg-popover text-popover-foreground">
          {item.items.map((subItem) => (
            <NavigationMenuLink asChild key={subItem.title} className="w-80">
              <SubMenuLink item={subItem} />
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
        className="bg-background hover:bg-muted hover:text-accent-foreground group inline-flex h-10 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
      >
        {item.title}
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
};

const renderMobileMenuItem = (item: MenuItem) => {
  if (item.items) {
    return (
      <AccordionItem key={item.title} value={item.title} className="border-b-0">
        <AccordionTrigger className="text-md py-0 font-semibold hover:no-underline">
          {item.title}
        </AccordionTrigger>
        <AccordionContent className="mt-2">
          {item.items.map((subItem) => (
            <SubMenuLink key={subItem.title} item={subItem} />
          ))}
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <a key={item.title} href={item.url} className="text-md font-semibold">
      {item.title}
    </a>
  );
};

const SubMenuLink = ({ item }: { item: MenuItem }) => {
  return (
    <a
      className="hover:bg-muted hover:text-accent-foreground flex min-w-80 select-none flex-row gap-4 rounded-md p-3 leading-none no-underline outline-none transition-colors"
      href={item.url}
    >
      <div className="text-foreground">{item.icon}</div>
      <div>
        <div className="text-sm font-semibold">{item.title}</div>
        {item.description && (
          <p className="text-muted-foreground text-sm leading-snug">
            {item.description}
          </p>
        )}
      </div>
    </a>
  );
};

export {Navbar1};