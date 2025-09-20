"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { QuoteCalculator, destinationZones } from "@/components/quote-calculator";
import { Truck, Package, Ship, Plane, Car, MapPin, Weight, Ruler, User, Mail, Phone, FileText } from "lucide-react";
import { Navbar1 } from "@/components/navbar1";

export default function QuotePage() {
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
    { value: "car", label: "Car Shipping", icon: Car, description: "Vehicle transportation" },
    { value: "parcel", label: "Parcel Delivery", icon: Package, description: "Small package shipping" },
    { value: "container", label: "Container Shipping", icon: Ship, description: "Full container loads" },
    { value: "air-express", label: "Air Express", icon: Plane, description: "Fast air freight" },
    { value: "freight", label: "Freight Forwarding", icon: Truck, description: "General cargo shipping" }
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === "files") {
          (value as File[]).forEach(file => data.append("files", file));
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

  const selectedShipmentType = shipmentTypes.find(type => type.value === formData.shipmentType);

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar1/>
        
        <div className="pt-24 pb-16 px-4">
          <div className="container mx-auto max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold mb-4">Quote Request Submitted!</h1>
              <p className="text-muted-foreground mb-8">
                Thank you for your quote request. Our team will review your requirements and get back to you within 24 hours with a detailed quote.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button onClick={() => window.location.href = "/"} variant="outline">
                  Back to Home
                </Button>
                <Button onClick={() => setIsSubmitted(false)}>
                  Submit Another Quote
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
      <Navbar1/>
      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl font-bold mb-4">Get Your Shipping Quote</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tell us about your shipment and we&apos;ll provide you with a competitive quote within 24 hours.
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
                    Shipment Type
                  </CardTitle>
                  <CardDescription>
                    Choose the type of shipment you need
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
                          onClick={() => handleInputChange("shipmentType", type.value)}
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
                              <div className="text-sm text-muted-foreground">{type.description}</div>
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
                    Shipment Details
                  </CardTitle>
                  <CardDescription>
                    Provide details about your shipment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Origin and Destination */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="origin" className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Origin
                        </Label>
                        <Input
                          id="origin"
                          value={formData.origin}
                          readOnly
                          className="bg-muted"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="destination" className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Destination Country
                        </Label>
                        <Select value={formData.destination} onValueChange={(value) => handleInputChange("destination", value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select destination country" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(destinationZones)
                              .sort()
                              .map((country) => (
                                <SelectItem key={country} value={country}>
                                  {country.charAt(0).toUpperCase() + country.slice(1)}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Weight and Dimensions */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="weight" className="flex items-center gap-2">
                          <Weight className="h-4 w-4" />
                          Weight (kg)
                        </Label>
                        <Input
                          id="weight"
                          type="number"
                          placeholder="Enter weight in kg"
                          value={formData.weight}
                          onChange={(e) => handleInputChange("weight", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dimensions" className="flex items-center gap-2">
                          <Ruler className="h-4 w-4" />
                          Dimensions (L×W×H cm)
                        </Label>
                        <Input
                          id="dimensions"
                          placeholder="e.g., 100×50×30"
                          value={formData.dimensions}
                          onChange={(e) => handleInputChange("dimensions", e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor="description">Shipment Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Describe your shipment (optional)"
                        value={formData.description}
                        onChange={(e) => handleInputChange("description", e.target.value)}
                        rows={3}
                      />
                    </div>

                    {/* Contact Information */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Contact Information
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Full Name</Label>
                          <Input
                            id="name"
                            placeholder="Enter your full name"
                            value={formData.name}
                            onChange={(e) => handleInputChange("name", e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email" className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="Enter your email"
                            value={formData.email}
                            onChange={(e) => handleInputChange("email", e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Phone Number
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="Enter your phone number"
                          value={formData.phone}
                          onChange={(e) => handleInputChange("phone", e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {/* File Upload
                    <div className="space-y-2">
                      <Label htmlFor="files" className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Supporting Documents (Optional)
                      </Label>
                      <Input
                        id="files"
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                      />
                      {formData.files.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.files.map((file, index) => (
                            <Badge key={index} variant="secondary">
                              {file.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div> */}

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
                            Processing...
                          </>
                        ) : (
                          "Request Quote"
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
                      <h3 className="font-semibold">Selected: {selectedShipmentType.label}</h3>
                      <p className="text-sm text-muted-foreground">{selectedShipmentType.description}</p>
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
