"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  QuoteCalculator,
  destinationZones,
} from "@/components/quote-calculator";
import {
  Truck,
  Package,
  Ship,
  Plane,
  Car,
  MapPin,
  Weight,
  Ruler,
  User,
  Mail,
  Phone,
  FileText,
} from "lucide-react";
import { useTranslations } from "next-intl";

export default function QuotePage() {
  const t = useTranslations("quote");

  const [formData, setFormData] = useState({
    shipmentType: "",
    origin: "Ireland",
    destination: "",
    weight: "",
    dimensions: "",
    description: "",
    name: "",
    email: "",
    phone: "",
    files: [] as File[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const shipmentTypes = [
    {
      value: "car",
      label: t("shipmentTypes.options.car.label"),
      icon: Car,
      description: t("shipmentTypes.options.car.description"),
    },
    {
      value: "parcel",
      label: t("shipmentTypes.options.parcel.label"),
      icon: Package,
      description: t("shipmentTypes.options.parcel.description"),
    },
    {
      value: "container",
      label: t("shipmentTypes.options.container.label"),
      icon: Ship,
      description: t("shipmentTypes.options.container.description"),
    },
    {
      value: "air-express",
      label: t("shipmentTypes.options.airExpress.label"),
      icon: Plane,
      description: t("shipmentTypes.options.airExpress.description"),
    },
    {
      value: "freight",
      label: t("shipmentTypes.options.freight.label"),
      icon: Truck,
      description: t("shipmentTypes.options.freight.description"),
    },
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === "files") {
          (value as File[]).forEach((file) => data.append("files", file));
        } else {
          data.append(key, value as string);
        }
      });

      const response = await fetch("/api/quote", {
        method: "POST",
        body: data,
      });

      if (!response.ok) {
        throw new Error("Failed to submit quote");
      }

      const result = await response.json();
      console.log("Quote submitted:", result);

      setIsSubmitted(true);
    } catch (error) {
      console.error("Error submitting quote:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedShipmentType = shipmentTypes.find(
    (type) => type.value === formData.shipmentType
  );

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">

        <div className="pt-24 pb-16 px-4">
          <div className="container mx-auto max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-bold mb-4">
                {t("success.title")}
              </h1>
              <p className="text-muted-foreground mb-8">
                {t("success.message")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => (window.location.href = "/")}
                  variant="outline"
                >
                  {t("success.buttons.backToHome")}
                </Button>
                <Button onClick={() => setIsSubmitted(false)}>
                  {t("success.buttons.submitAnother")}
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl font-bold mb-4">{t("hero.title")}</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t("hero.subtitle")}
            </p>
          </motion.div>

          {/* Quote Calculator - Top Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8"
          >
            <QuoteCalculator
              shipmentType={formData.shipmentType}
              destination={formData.destination}
              weight={formData.weight}
              dimensions={formData.dimensions}
            />
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Shipment Type Selection */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {t("shipmentTypes.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("shipmentTypes.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {shipmentTypes.map((type) => {
                    const IconComponent = type.icon;
                    return (
                      <motion.div
                        key={type.value}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleInputChange("shipmentType", type.value)
                          }
                          className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                            formData.shipmentType === type.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <IconComponent className="h-6 w-6 text-primary" />
                            <div>
                              <div className="font-medium">{type.label}</div>
                              <div className="text-sm text-muted-foreground">
                                {type.description}
                              </div>
                            </div>
                          </div>
                        </button>
                      </motion.div>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.div>

            {/* Quote Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="lg:col-span-2"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {t("form.title")}
                  </CardTitle>
                  <CardDescription>{t("form.description")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Origin and Destination */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="origin"
                          className="flex items-center gap-2"
                        >
                          <MapPin className="h-4 w-4" />
                          {t("form.fields.origin")}
                        </Label>
                        <Input
                          id="origin"
                          value={formData.origin}
                          readOnly
                          className="bg-muted"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="destination"
                          className="flex items-center gap-2"
                        >
                          <MapPin className="h-4 w-4" />
                          {t("form.fields.destination")}
                        </Label>
                        <Select
                          value={formData.destination}
                          onValueChange={(value) =>
                            handleInputChange("destination", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t(
                                "form.fields.destinationPlaceholder"
                              )}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(destinationZones)
                              .sort()
                              .map((country) => (
                                <SelectItem key={country} value={country}>
                                  {country.charAt(0).toUpperCase() +
                                    country.slice(1)}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Weight and Dimensions */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="weight"
                          className="flex items-center gap-2"
                        >
                          <Weight className="h-4 w-4" />
                          {t("form.fields.weight")}
                        </Label>
                        <Input
                          id="weight"
                          type="number"
                          placeholder={t("form.fields.weightPlaceholder")}
                          value={formData.weight}
                          onChange={(e) =>
                            handleInputChange("weight", e.target.value)
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="dimensions"
                          className="flex items-center gap-2"
                        >
                          <Ruler className="h-4 w-4" />
                          {t("form.fields.dimensions")}
                        </Label>
                        <Input
                          id="dimensions"
                          placeholder={t("form.fields.dimensionsPlaceholder")}
                          value={formData.dimensions}
                          onChange={(e) =>
                            handleInputChange("dimensions", e.target.value)
                          }
                          required
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor="description">
                        {t("form.fields.description")}
                      </Label>
                      <Textarea
                        id="description"
                        placeholder={t("form.fields.descriptionPlaceholder")}
                        value={formData.description}
                        onChange={(e) =>
                          handleInputChange("description", e.target.value)
                        }
                        rows={3}
                      />
                    </div>

                    {/* Contact Information */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {t("form.fields.contactInfo")}
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">
                            {t("form.fields.fullName")}
                          </Label>
                          <Input
                            id="name"
                            placeholder={t("form.fields.fullNamePlaceholder")}
                            value={formData.name}
                            onChange={(e) =>
                              handleInputChange("name", e.target.value)
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="email"
                            className="flex items-center gap-2"
                          >
                            <Mail className="h-4 w-4" />
                            {t("form.fields.email")}
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder={t("form.fields.emailPlaceholder")}
                            value={formData.email}
                            onChange={(e) =>
                              handleInputChange("email", e.target.value)
                            }
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="phone"
                          className="flex items-center gap-2"
                        >
                          <Phone className="h-4 w-4" />
                          {t("form.fields.phone")}
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder={t("form.fields.phonePlaceholder")}
                          value={formData.phone}
                          onChange={(e) =>
                            handleInputChange("phone", e.target.value)
                          }
                          required
                        />
                      </div>
                    </div>

                    {/* Submit Button */}
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        type="submit"
                        size="lg"
                        className="w-full"
                        disabled={isSubmitting || !formData.shipmentType}
                      >
                        {isSubmitting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            {t("form.buttons.processing")}
                          </>
                        ) : (
                          t("form.buttons.submit")
                        )}
                      </Button>
                    </motion.div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Selected Shipment Type Summary */}
          {selectedShipmentType && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8"
            >
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <selectedShipmentType.icon className="h-6 w-6 text-primary" />
                    <div>
                      <h3 className="font-semibold">
                        {t("selectedSummary.prefix")}{" "}
                        {selectedShipmentType.label}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedShipmentType.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
