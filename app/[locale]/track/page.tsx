"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Package, 
  MapPin, 
  Clock, 
  Truck, 
  CheckCircle, 
  AlertCircle,
  Download,
  Eye,
  LucideIcon
} from "lucide-react";

interface TrackingEvent {
  id: string;
  status: string;
  location: string;
  timestamp: string;
  description: string;
  icon: LucideIcon;
}

interface ShipmentData {
  trackingNumber: string;
  bookingNumber: string;
  status: string;
  origin: string;
  destination: string;
  estimatedDelivery: string;
  currentLocation: string;
  events: TrackingEvent[];
  details: {
    weight: string;
    dimensions: string;
    service: string;
    carrier: string;
  };
}

export default function TrackPage() {
  const t = useTranslations("track");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shipment, setShipment] = useState<ShipmentData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingNumber.trim()) return;

    setIsLoading(true);
    setError("");
    
    try {
      const response = await fetch(`/api/track?trackingNumber=${encodeURIComponent(trackingNumber)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError(t("form.errors.notFound"));
        } else {
          setError(t("form.errors.generic"));
        }
        return;
      }

      const result = await response.json();
      if (result.success) {
        setShipment(result.data);
      } else {
        setError(t("form.errors.generic"));
      }
    } catch (error) {
      console.error("Tracking error:", error);
      setError(t("form.errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return "bg-green-100 text-green-800 border-green-200";
      case "in transit":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "processing":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "delayed":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return CheckCircle;
      case "in transit":
        return Truck;
      case "processing":
        return Clock;
      case "delayed":
        return AlertCircle;
      default:
        return Package;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Hero */}
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

          {/* Search Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  {t("form.title")}
                </CardTitle>
                <CardDescription>
                  {t("form.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearch} className="flex gap-4">
                  <div className="flex-1">
                    <Label htmlFor="tracking" className="sr-only">
                      {t("form.title")}
                    </Label>
                    <Input
                      id="tracking"
                      placeholder={t("form.placeholder")}
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
                      className="text-lg"
                    />
                  </div>
                  <Button type="submit" size="lg" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {t("form.buttons.searching")}
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        {t("form.buttons.track")}
                      </>
                    )}
                  </Button>
                </form>
                {error && (
                  <p className="text-red-600 text-sm mt-2">{error}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Shipment Details */}
          {shipment && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-6"
            >
              {/* Status Overview */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        {t("shipment.status.title")}
                      </CardTitle>
                      <CardDescription>
                        {t("shipment.status.tracking")} {shipment.trackingNumber} | {t("shipment.status.booking")} {shipment.bookingNumber}
                      </CardDescription>
                    </div>
                    <Badge className={`${getStatusColor(shipment.status)} text-sm font-medium`}>
                      {shipment.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{t("shipment.details.origin")}</p>
                        <p className="text-xs text-muted-foreground">{shipment.origin}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{t("shipment.details.destination")}</p>
                        <p className="text-xs text-muted-foreground">{shipment.destination}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{t("shipment.details.estimatedDelivery")}</p>
                        <p className="text-xs text-muted-foreground">{shipment.estimatedDelivery}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{t("shipment.details.currentLocation")}</p>
                        <p className="text-xs text-muted-foreground">{shipment.currentLocation}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tracking Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("shipment.timeline.title")}</CardTitle>
                  <CardDescription>
                    {t("shipment.timeline.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {shipment.events.map((event, index) => {
                      const IconComponent = event.icon;
                      const isLast = index === shipment.events.length - 1;
                      return (
                        <div key={event.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className={`p-2 rounded-full ${
                              isLast ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            }`}>
                              <IconComponent className="h-4 w-4" />
                            </div>
                            {!isLast && (
                              <div className="w-px h-8 bg-border mt-2"></div>
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">{event.description}</h4>
                              <span className="text-sm text-muted-foreground">
                                {new Date(event.timestamp).toLocaleDateString()} {new Date(event.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{event.location}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Shipment Details */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("shipment.information.title")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t("shipment.information.weight")}</Label>
                      <p className="text-sm text-muted-foreground">{shipment.details.weight}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t("shipment.information.dimensions")}</Label>
                      <p className="text-sm text-muted-foreground">{shipment.details.dimensions}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t("shipment.information.service")}</Label>
                      <p className="text-sm text-muted-foreground">{shipment.details.service}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t("shipment.information.carrier")}</Label>
                      <p className="text-sm text-muted-foreground">{shipment.details.carrier}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button variant="outline" className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      {t("shipment.actions.downloadInvoice")}
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      {t("shipment.actions.viewDocuments")}
                    </Button>
                    <Button className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      {t("shipment.actions.trackAnother")}
                    </Button>
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
