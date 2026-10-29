"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Circle, Package, Search, Ship, Truck, Warehouse, type LucideIcon } from "lucide-react";

interface TrackingEvent {
  milestone: string;
  location: string;
  occurredAt: string;
}

interface ShipmentData {
  reference: string;
  status: string;
  events: TrackingEvent[];
}

const MILESTONE_ICONS: Record<string, LucideIcon> = {
  BOOKED: Package,
  RECEIVED_AT_DEPOT: Warehouse,
  DEPARTED_ORIGIN: Ship,
  OUT_FOR_DELIVERY: Truck,
  DELIVERED: CheckCircle,
};

const KNOWN_MILESTONES = ["BOOKED", "RECEIVED_AT_DEPOT", "DEPARTED_ORIGIN", "OUT_FOR_DELIVERY", "DELIVERED"];

export default function TrackPage() {
  const t = useTranslations("track");
  const format = useFormatter();
  const [reference, setReference] = useState("");
  const [shipment, setShipment] = useState<ShipmentData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim()) return;
    setIsLoading(true);
    setError("");
    setShipment(null);
    try {
      const response = await fetch(`/api/track?reference=${encodeURIComponent(reference.trim())}`);
      if (!response.ok) {
        setError(response.status === 404 || response.status === 400 ? t("form.errors.notFound") : t("form.errors.generic"));
        return;
      }
      const result = await response.json();
      setShipment(result.data);
    } catch {
      setError(t("form.errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="pt-24 pb-16 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">{t("hero.title")}</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">{t("hero.subtitle")}</p>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" aria-hidden />
                {t("form.title")}
              </CardTitle>
              <CardDescription>{t("form.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <Label htmlFor="tracking" className="sr-only">
                    {t("form.title")}
                  </Label>
                  <Input
                    id="tracking"
                    placeholder={t("form.placeholder")}
                    value={reference}
                    onChange={(e) => setReference(e.target.value.toUpperCase())}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "tracking-error" : undefined}
                    className="text-lg"
                  />
                </div>
                <Button type="submit" size="lg" disabled={isLoading} aria-busy={isLoading}>
                  {isLoading ? t("form.buttons.searching") : t("form.buttons.track")}
                </Button>
              </form>
              <p id="tracking-error" role="alert" className="text-destructive text-sm mt-2 min-h-5">
                {error}
              </p>
            </CardContent>
          </Card>

          {shipment && (
            <Card>
              <CardHeader>
                <CardTitle>{t("shipment.timeline.title")}</CardTitle>
                <CardDescription>
                  {t("shipment.status.tracking")} {shipment.reference}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  {shipment.events.map((event, index) => {
                    const Icon = MILESTONE_ICONS[event.milestone] ?? Circle;
                    const label = KNOWN_MILESTONES.includes(event.milestone)
                      ? t(`milestones.${event.milestone}` as "milestones.BOOKED")
                      : event.milestone;
                    return (
                      <li key={`${event.milestone}-${index}`} className="flex gap-4">
                        <span className="p-2 rounded-full bg-muted h-fit" aria-hidden>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="flex-1">
                          <p className="font-medium">{label}</p>
                          <p className="text-sm text-muted-foreground">
                            {event.location} ·{" "}
                            {format.dateTime(new Date(event.occurredAt), { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
