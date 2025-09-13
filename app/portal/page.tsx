"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navigation } from "@/components/navigation";
import { 
  Package, 
  MapPin, 
  Clock, 
  Truck, 
  Download,
  Eye,
  Plus,
  Search,
  Filter,
  Euro,
  FileText,
  Settings
} from "lucide-react";
import { navigationConfig } from "../page";

interface Shipment {
  id: string;
  trackingNumber: string;
  bookingNumber: string;
  status: string;
  origin: string;
  destination: string;
  estimatedDelivery: string;
  service: string;
  cost: number;
  createdAt: string;
}

interface Quote {
  id: string;
  shipmentType: string;
  destination: string;
  weight: string;
  estimatedCost: number;
  status: string;
  createdAt: string;
}

// Mock data
const mockShipments: Shipment[] = [
  {
    id: "1",
    trackingNumber: "ML123456789",
    bookingNumber: "BK987654321",
    status: "In Transit",
    origin: "Dublin, Ireland",
    destination: "New York, USA",
    estimatedDelivery: "2024-01-15",
    service: "Sea Freight",
    cost: 1250,
    createdAt: "2024-01-08"
  },
  {
    id: "2",
    trackingNumber: "ML987654321",
    bookingNumber: "BK123456789",
    status: "Delivered",
    origin: "Cork, Ireland",
    destination: "London, UK",
    estimatedDelivery: "2024-01-12",
    service: "Express Shipping",
    cost: 85,
    createdAt: "2024-01-10"
  },
  {
    id: "3",
    trackingNumber: "ML456789123",
    bookingNumber: "BK456789123",
    status: "Processing",
    origin: "Galway, Ireland",
    destination: "Sydney, Australia",
    estimatedDelivery: "2024-01-20",
    service: "Air Express",
    cost: 450,
    createdAt: "2024-01-12"
  }
];

const mockQuotes: Quote[] = [
  {
    id: "1",
    shipmentType: "Car Shipping",
    destination: "Germany",
    weight: "1500 kg",
    estimatedCost: 1200,
    status: "Pending",
    createdAt: "2024-01-13"
  },
  {
    id: "2",
    shipmentType: "Parcel Delivery",
    destination: "France",
    weight: "5 kg",
    estimatedCost: 35,
    status: "Approved",
    createdAt: "2024-01-12"
  },
  {
    id: "3",
    shipmentType: "Container Shipping",
    destination: "China",
    weight: "25000 kg",
    estimatedCost: 3500,
    status: "Expired",
    createdAt: "2024-01-10"
  }
];

export default function PortalPage() {
  const [activeTab, setActiveTab] = useState<"shipments" | "quotes" | "documents">("shipments");
  const [searchTerm, setSearchTerm] = useState("");

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return "bg-green-100 text-green-800 border-green-200";
      case "in transit":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "processing":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "pending":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "approved":
        return "bg-green-100 text-green-800 border-green-200";
      case "expired":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const filteredShipments = mockShipments.filter(shipment =>
    shipment.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shipment.destination.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredQuotes = mockQuotes.filter(quote =>
    quote.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.shipmentType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation 
        {...navigationConfig}
      />
      
      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">Client Portal</h1>
                <p className="text-muted-foreground">
                  Manage your shipments, quotes, and documents
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  New Quote
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-6"
          >
            <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
              {[
                { id: "shipments", label: "Shipments", count: mockShipments.length },
                { id: "quotes", label: "Quotes", count: mockQuotes.length },
                { id: "documents", label: "Documents", count: 0 }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as "shipments" | "quotes" | "documents")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-6"
          >
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="search" className="sr-only">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder={`Search ${activeTab}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {activeTab === "shipments" && (
              <div className="space-y-4">
                {filteredShipments.map((shipment) => (
                  <Card key={shipment.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold">{shipment.trackingNumber}</h3>
                            <Badge className={getStatusColor(shipment.status)}>
                              {shipment.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span>{shipment.origin} → {shipment.destination}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>Est. Delivery: {shipment.estimatedDelivery}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4" />
                              <span>{shipment.service}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col md:items-end gap-2">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Total Cost</p>
                            <p className="text-lg font-semibold flex items-center gap-1">
                              <Euro className="h-4 w-4" />
                              {shipment.cost.toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              Track
                            </Button>
                            <Button variant="outline" size="sm" className="flex items-center gap-1">
                              <Download className="h-3 w-3" />
                              Invoice
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "quotes" && (
              <div className="space-y-4">
                {filteredQuotes.map((quote) => (
                  <Card key={quote.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold">Quote #{quote.id}</h3>
                            <Badge className={getStatusColor(quote.status)}>
                              {quote.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4" />
                              <span>{quote.shipmentType}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span>To: {quote.destination}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4" />
                              <span>Weight: {quote.weight}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col md:items-end gap-2">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Estimated Cost</p>
                            <p className="text-lg font-semibold flex items-center gap-1">
                              <Euro className="h-4 w-4" />
                              {quote.estimatedCost.toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              View
                            </Button>
                            {quote.status === "Approved" && (
                              <Button size="sm" className="flex items-center gap-1">
                                <Plus className="h-3 w-3" />
                                Book
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "documents" && (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No Documents Available</h3>
                  <p className="text-muted-foreground mb-4">
                    Documents will appear here once you have active shipments
                  </p>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Create New Shipment
                  </Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
