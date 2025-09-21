"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Contact2Props {
  phone?: string;
  phone2?: string;
  email?: string;
  web?: { label: string; url: string };
}

const Contact2 = ({
  phone = "+353896160927",
  phone2 = "+237695739033",
  email = "marchelodis@gmail.com",
  web = { label: "marchelo-logistics.com", url: "https://marchelo-logistics.com/" },
}: Contact2Props) => {
  const t = useTranslations("contact");

  return (
    <section className="py-32">
      <div className="container">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-10 lg:flex-row lg:gap-20">
          <div className="mx-auto flex max-w-sm flex-col justify-between gap-10">
            <div className="text-center lg:text-left">
              <h1 className="mb-2 text-5xl font-semibold lg:mb-1 lg:text-6xl">
                {t("title")}
              </h1>
              <p className="text-muted-foreground">{t("description")}</p>
            </div>
            <div className="mx-auto w-fit lg:mx-0">
              <h3 className="mb-6 text-center text-2xl font-semibold lg:text-left">
                {t("details.heading")}
              </h3>
              <ul className="ml-4 list-disc">
                <li>
                  <span className="font-bold">{t("details.irelandTel")} </span>
                  {phone}
                </li>
                <li>
                  <span className="font-bold">{t("details.cameroonTel")} </span>
                  {phone2}
                </li>
                <li>
                  <span className="font-bold">{t("details.email")} </span>
                  <a href={`mailto:${email}`} className="underline">
                    {email}
                  </a>
                </li>
                <li>
                  <span className="font-bold">{t("details.web")} </span>
                  <a href={web.url} target="_blank" className="underline">
                    {web.label}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-lg border-0 shadow-2xl p-10">
            <div className="flex gap-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="firstname">{t("form.firstName.label")}</Label>
                <Input type="text" id="firstname" placeholder={t("form.firstName.placeholder")} />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="lastname">{t("form.lastName.label")}</Label>
                <Input type="text" id="lastname" placeholder={t("form.lastName.placeholder")} />
              </div>
            </div>
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="email">{t("form.email.label")}</Label>
              <Input type="email" id="email" placeholder={t("form.email.placeholder")} />
            </div>
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="subject">{t("form.subject.label")}</Label>
              <Input type="text" id="subject" placeholder={t("form.subject.placeholder")} />
            </div>
            <div className="grid w-full gap-1.5">
              <Label htmlFor="message">{t("form.message.label")}</Label>
              <Textarea placeholder={t("form.message.placeholder")} id="message" />
            </div>
            <Button className="w-full">{t("form.button")}</Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Contact2 };
