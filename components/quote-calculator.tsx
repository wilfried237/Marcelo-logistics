"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, Euro, Clock, MapPin, Package } from "lucide-react";
import { motion } from "framer-motion";

interface QuoteCalculatorProps {
  shipmentType: string;
  destination: string;
  weight: string;
  dimensions: string;
}

interface PricingTier {
  basePrice: number;
  weightMultiplier: number;
  distanceMultiplier: number;
  estimatedDays: number;
  description: string;
}

export const pricingTiers: Record<string, PricingTier> = {
  car: {
    basePrice: 800,
    weightMultiplier: 0,
    distanceMultiplier: 0.8,
    estimatedDays: 7,
    description: "Vehicle transportation with insurance"
  },
  parcel: {
    basePrice: 25,
    weightMultiplier: 2.5,
    distanceMultiplier: 0.3,
    estimatedDays: 3,
    description: "Small package delivery"
  },
  container: {
    basePrice: 1200,
    weightMultiplier: 0.5,
    distanceMultiplier: 1.2,
    estimatedDays: 14,
    description: "Full container shipping"
  },
  "air-express": {
    basePrice: 45,
    weightMultiplier: 8,
    distanceMultiplier: 0.4,
    estimatedDays: 2,
    description: "Fast air freight service"
  },
  freight: {
    basePrice: 150,
    weightMultiplier: 1.5,
    distanceMultiplier: 0.6,
    estimatedDays: 5,
    description: "General cargo forwarding"
  }
};

export const destinationZones: Record<string, number> = {
  // Europe
  "ireland": 1.0,
  "united kingdom": 1.2,
  "france": 1.1,
  "germany": 1.1,
  "spain": 1.3,
  "italy": 1.2,
  "netherlands": 1.0,
  "belgium": 1.0,
  "switzerland": 1.2,
  "austria": 1.1,
  "poland": 1.1,
  "czech republic": 1.1,
  "sweden": 1.2,
  "norway": 1.3,
  "denmark": 1.1,
  "finland": 1.2,
  
  // North America
  "united states": 2.5,
  "canada": 2.3,
  "mexico": 2.0,
  
  // Asia
  "china": 3.0,
  "japan": 2.8,
  "south korea": 2.7,
  "singapore": 2.5,
  "hong kong": 2.6,
  "india": 2.2,
  "thailand": 2.3,
  "malaysia": 2.4,
  "indonesia": 2.5,
  "philippines": 2.6,
  "vietnam": 2.4,
  
  // Oceania
  "australia": 3.2,
  "new zealand": 3.3,
  
  // Africa
  "south africa": 2.8,
  "egypt": 2.2,
  "morocco": 1.8,
  "nigeria": 2.5,
  "kenya": 2.6,
  "tanzania": 2.7,
  "uganda": 2.8,
  "malawi": 2.9,
  "zambia": 3.0,
  "zimbabwe": 3.1,
  "rwanda": 3.2,
  "burundi": 3.3,
  "congo": 3.4,
  "madagascar": 3.5,
  "malagasy": 3.6,
  "comoros": 3.7,
  "seychelles": 3.8,
  "sri lanka": 3.9,
  "cameroon": 4.0,
  "gabon": 4.1,
  "equatorial guinea": 4.2,
  "congo brazzaville": 4.3,
  "congo kinshasa": 4.4,
  
  // South America
  "brazil": 2.7,
  "argentina": 2.8,
  "chile": 2.9,
  "colombia": 2.6,
  "peru": 2.7,
  
  // Middle East
  "united arab emirates": 2.0,
  "saudi arabia": 2.1,
  "israel": 1.9,
  "turkey": 1.4,
  "qatar": 2.0,
  "kuwait": 2.0,
  "bahrain": 2.0,
  "oman": 2.1
};

export function QuoteCalculator({ shipmentType, destination, weight, dimensions }: QuoteCalculatorProps) {
  const calculateQuote = () => {
    if (!shipmentType || !destination || !weight) {
      return null;
    }

    const tier = pricingTiers[shipmentType];
    if (!tier) return null;

    const weightNum = parseFloat(weight) || 0;
    const destinationKey = destination.toLowerCase().trim();
    const distanceMultiplier = destinationZones[destinationKey] || 2.0; // Default for unknown destinations

    // Calculate base cost
    let totalCost = tier.basePrice;
    
    // Add weight-based cost
    if (weightNum > 0) {
      totalCost += weightNum * tier.weightMultiplier;
    }
    
    // Apply distance multiplier
    totalCost *= distanceMultiplier;
    
    // Add dimension-based cost for certain shipment types
    if (dimensions && (shipmentType === 'parcel' || shipmentType === 'air-express')) {
      const dims = dimensions.split('×').map(d => parseFloat(d.trim())).filter(d => !isNaN(d));
      if (dims.length === 3) {
        const volume = (dims[0] * dims[1] * dims[2]) / 1000000; // Convert to cubic meters
        totalCost += volume * 50; // €50 per cubic meter for small shipments
      }
    }

    // Apply minimum charges
    const minimums = {
      car: 500,
      parcel: 15,
      container: 800,
      "air-express": 30,
      freight: 100
    };

    totalCost = Math.max(totalCost, minimums[shipmentType as keyof typeof minimums] || 50);

    return {
      baseCost: Math.round(totalCost),
      estimatedDays: tier.estimatedDays,
      description: tier.description,
      distanceMultiplier,
      breakdown: {
        basePrice: tier.basePrice,
        weightCost: weightNum * tier.weightMultiplier,
        distanceCost: (tier.basePrice + (weightNum * tier.weightMultiplier)) * (distanceMultiplier - 1)
      }
    };
  };

  const quote = calculateQuote();

  if (!quote) {
    return (
      <Card className="border-dashed border-2">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-muted-foreground text-xl">
            Quote Calculator
          </CardTitle>
          <CardDescription className="text-base">
            Fill in shipment details below to see your instant estimate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-16 w-16 mx-auto mb-6 opacity-50" />
            <p className="text-lg font-medium mb-2">Ready to calculate your shipping cost?</p>
            <p className="text-sm">Select a shipment type, destination, and weight to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <Calculator className="h-6 w-6 text-primary" />
            Instant Quote Estimate
          </CardTitle>
          <CardDescription className="text-base">
            {quote.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main Price */}
          <div className="text-center">
            <div className="text-4xl font-bold text-primary flex items-center justify-center gap-2">
              <Euro className="h-8 w-8" />
              {quote.baseCost.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Estimated total cost</p>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{quote.estimatedDays} days</p>
                <p className="text-xs text-muted-foreground">Estimated delivery</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{destination}</p>
                <p className="text-xs text-muted-foreground">Destination</p>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-2 pt-4 border-t">
            <h4 className="text-sm font-medium">Cost Breakdown</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base price:</span>
                <span>€{quote.breakdown.basePrice}</span>
              </div>
              {quote.breakdown.weightCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weight ({weight}kg):</span>
                  <span>€{Math.round(quote.breakdown.weightCost)}</span>
                </div>
              )}
              {quote.breakdown.distanceCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Distance surcharge:</span>
                  <span>€{Math.round(quote.breakdown.distanceCost)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="pt-4 border-t">
            <Badge variant="outline" className="text-xs">
              * This is an estimate. Final price may vary based on specific requirements.
            </Badge>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
