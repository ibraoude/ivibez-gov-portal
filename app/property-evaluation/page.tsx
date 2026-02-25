"use client"
import Image from "next/image";
import { useState } from "react";
import { 
  Building2, 
  MapPin, 
  DollarSign, 
  FileText, 
  Loader2,
  TrendingUp,
  Calculator,
  Home,
  Hammer,
  PiggyBank,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Percent,
  Calendar,
  Users,
  Zap
} from "lucide-react";

type Strategy = "flip" | "ground-up" | "government";

interface PropertyData {
  address: string;
  formattedAddress: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  zoning: {
    code: string;
    description: string;
    allowedUses: string[];
    maxHeight?: string;
    maxCoverage?: string;
    setbacks?: string;
  };
  landValue: number;
  existingProperty?: {
    yearBuilt: number;
    squareFeet: number;
    bedrooms?: number;
    bathrooms?: number;
    condition: string;
    estimatedValue: number;
  };
  buildingCosts: {
    landPreparation: number;
    construction: number;
    permitsAndFees: number;
    architecture: number;
    softCosts: number;
    contingency: number;
    total: number;
    costPerSqFt: number;
  };
  marketAnalysis: {
    averagePricePerSqFt: number;
    estimatedSellPrice: number;
    estimatedRentalIncome?: number;
    daysOnMarket: number;
    marketTrend: 'hot' | 'moderate' | 'slow';
    comparables: Array<{
      address: string;
      price: number;
      sqft: number;
      distance: string;
    }>;
  };
  financialAnalysis: {
    totalInvestment: number;
    estimatedProfit: number;
    profitMargin: number;
    roi: number;
    breakEvenPrice: number;
    capRate?: number;
    cashOnCash?: number;
  };
  taxInfo: {
    annualPropertyTax: number;
    taxRate: number;
    assessedValue: number;
  };
  recommendations: string[];
  risks: string[];
}

interface DevelopmentOptions {
  propertyType: 'single-family' | 'multi-family' | 'commercial' | 'mixed-use';
  squareFeet: number;
  units?: number;
  stories: number;
  finishQuality: 'basic' | 'standard' | 'premium' | 'luxury';
}

export default function PropertyEvaluation() {
  const [address, setAddress] = useState("");
  const [strategy, setStrategy] = useState<Strategy>("flip");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null);
  const [developmentOptions, setDevelopmentOptions] = useState<DevelopmentOptions>({
    propertyType: 'single-family',
    squareFeet: 2000,
    units: 1,
    stories: 1,
    finishQuality: 'standard'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address.trim()) {
      setError("Please enter an address");
      return;
    }

    setLoading(true);
    setError(null);
    setPropertyData(null);

    try {
      const response = await fetch("/api/evaluate-property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          developmentOptions,
          strategy
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to evaluate property");
      }

      setPropertyData(data);

    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Property evaluation error:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-16 px-4">
  <div className="max-w-6xl mx-auto">

    {/* Header */}
    <div className="text-center mb-16">

      {/* Logo */}
      <div className="flex justify-center mb-8">
        <div className="flex items-baseline">
          <span className="text-6xl md:text-7xl font-black text-green-700 tracking-tight">
            iVibeZ
          </span>
          <span className="ml-3 text-3xl md:text-4xl font-bold text-blue-700 tracking-tight">
            Solutions
          </span>
        </div>
      </div>

      {/* Brand Name */}
      <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 tracking-tight">
        Property Intelligence Engine
      </h1>

      {/* Tagline */}
      <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
        Comprehensive property analysis tool for investors and developers. Get instant insights on zoning, construction costs, market value, and profit potential.
      </p>

    </div>

        {/* Search Form */}
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 mb-8">
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="address" className="block text-sm font-semibold text-gray-700 mb-2">
                Property Address
              </label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter street address, city, state, ZIP"
                  className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  disabled={loading}
                />
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Investment Strategy
              </label>

              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as Strategy)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="flip">Fix & Flip</option>
                <option value="ground-up">Ground-Up Development</option>
                <option value="government">Government / Public Feasibility</option>
              </select>
            </div>

            {/* Development Options */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Hammer className="w-5 h-5 text-blue-600" />
                Development Specifications
              </h3>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Property Type
                  </label>
                  <select
                    value={developmentOptions.propertyType}
                    onChange={(e) => setDevelopmentOptions({
                      ...developmentOptions, 
                      propertyType: e.target.value as any
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="single-family">Single-Family Home</option>
                    <option value="multi-family">Multi-Family (Duplex/Triplex)</option>
                    <option value="commercial">Commercial Building</option>
                    <option value="mixed-use">Mixed-Use Development</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Square Feet
                  </label>
                  <input
                    type="number"
                    value={developmentOptions.squareFeet}
                    onChange={(e) => setDevelopmentOptions({
                      ...developmentOptions,
                      squareFeet: parseInt(e.target.value) || 0
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="500"
                    step="100"
                  />
                </div>

                {(developmentOptions.propertyType === 'multi-family' || 
                  developmentOptions.propertyType === 'mixed-use') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Units
                    </label>
                    <input
                      type="number"
                      value={developmentOptions.units || 1}
                      onChange={(e) => setDevelopmentOptions({
                        ...developmentOptions,
                        units: parseInt(e.target.value) || 1
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="2"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Stories
                  </label>
                  <input
                    type="number"
                    value={developmentOptions.stories}
                    onChange={(e) => setDevelopmentOptions({
                      ...developmentOptions,
                      stories: parseInt(e.target.value) || 1
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="10"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Finish Quality
                  </label>
                  <select
                    value={developmentOptions.finishQuality}
                    onChange={(e) => setDevelopmentOptions({
                      ...developmentOptions,
                      finishQuality: e.target.value as any
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="basic">Basic ($80-120/sqft)</option>
                    <option value="standard">Standard ($120-180/sqft)</option>
                    <option value="premium">Premium ($180-250/sqft)</option>
                    <option value="luxury">Luxury ($250+/sqft)</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-8 py-4 bg-blue-600 text-white font-semibold text-lg rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Analyzing Property...
                </>
              ) : (
                <>
                  <Calculator className="w-6 h-6" />
                  Analyze Property & Calculate Profit
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {propertyData && (
          <div className="space-y-6">
            {/* Key Metrics Overview */}
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5" />
                  <p className="text-sm font-medium opacity-90">Estimated Profit</p>
                </div>
                <p className="text-3xl font-bold">
                  {formatCurrency(propertyData.financialAnalysis.estimatedProfit)}
                </p>
                <p className="text-sm mt-2 opacity-90">
                  {formatPercent(propertyData.financialAnalysis.profitMargin)} margin
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5" />
                  <p className="text-sm font-medium opacity-90">Estimated Sell Price</p>
                </div>
                <p className="text-3xl font-bold">
                  {formatCurrency(propertyData.marketAnalysis.estimatedSellPrice)}
                </p>
                <p className="text-sm mt-2 opacity-90">
                  {formatCurrency(propertyData.marketAnalysis.averagePricePerSqFt)}/sqft
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Hammer className="w-5 h-5" />
                  <p className="text-sm font-medium opacity-90">Building Costs</p>
                </div>
                <p className="text-3xl font-bold">
                  {formatCurrency(propertyData.buildingCosts.total)}
                </p>
                <p className="text-sm mt-2 opacity-90">
                  {formatCurrency(propertyData.buildingCosts.costPerSqFt)}/sqft
                </p>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="w-5 h-5" />
                  <p className="text-sm font-medium opacity-90">ROI</p>
                </div>
                <p className="text-3xl font-bold">
                  {formatPercent(propertyData.financialAnalysis.roi)}
                </p>
                <p className="text-sm mt-2 opacity-90">Return on Investment</p>
              </div>
            </div>

            {/* Property Information */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <MapPin className="w-6 h-6 text-blue-600 mt-1" />
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                    Property Location
                  </h2>
                  <p className="text-lg text-gray-700">{propertyData.formattedAddress}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Coordinates: {propertyData.coordinates.lat.toFixed(6)}, {propertyData.coordinates.lng.toFixed(6)}
                  </p>
                </div>
              </div>
            </div>

            {/* Zoning Information */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <FileText className="w-6 h-6 text-green-600 mt-1" />
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                    Zoning & Land Use
                  </h2>
                  <div className="inline-block bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-bold mb-4">
                    {propertyData.zoning.code}
                  </div>
                  <p className="text-gray-700 mb-4 text-lg">{propertyData.zoning.description}</p>
                  
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    {propertyData.zoning.maxHeight && (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Max Height</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {propertyData.zoning.maxHeight}
                        </p>
                      </div>
                    )}
                    {propertyData.zoning.maxCoverage && (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Max Coverage</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {propertyData.zoning.maxCoverage}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Allowed Uses:</h3>
                    <div className="grid md:grid-cols-2 gap-2">
                      {propertyData.zoning.allowedUses.map((use, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span className="text-gray-700">{use}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Building Costs Breakdown */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <Calculator className="w-6 h-6 text-purple-600 mt-1" />
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                    Construction Cost Breakdown
                  </h2>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-3 border-b border-gray-200">
                      <span className="text-gray-700">Land Value</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatCurrency(propertyData.landValue)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-200">
                      <span className="text-gray-700">Land Preparation & Utilities</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatCurrency(propertyData.buildingCosts.landPreparation)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-200">
                      <span className="text-gray-700">Construction Costs</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatCurrency(propertyData.buildingCosts.construction)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-200">
                      <span className="text-gray-700">Architecture & Engineering</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatCurrency(propertyData.buildingCosts.architecture)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-200">
                      <span className="text-gray-700">Permits & Fees</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatCurrency(propertyData.buildingCosts.permitsAndFees)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-200">
                      <span className="text-gray-700">Soft Costs (Legal, Marketing, etc.)</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatCurrency(propertyData.buildingCosts.softCosts)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-200">
                      <span className="text-gray-700">Contingency (10%)</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatCurrency(propertyData.buildingCosts.contingency)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-4 bg-purple-50 -mx-3 px-3 rounded-lg mt-2">
                      <span className="text-lg font-bold text-gray-900">Total Project Cost</span>
                      <span className="text-2xl font-bold text-purple-600">
                        {formatCurrency(propertyData.buildingCosts.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Market Analysis */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <BarChart3 className="w-6 h-6 text-blue-600 mt-1" />
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                    Market Analysis
                  </h2>
                  
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-600">
                      <p className="text-sm text-gray-600 mb-1">Market Trend</p>
                      <div className="flex items-center gap-2">
                        <Zap className={`w-5 h-5 ${
                          propertyData.marketAnalysis.marketTrend === 'hot' ? 'text-red-600' :
                          propertyData.marketAnalysis.marketTrend === 'moderate' ? 'text-yellow-600' :
                          'text-blue-600'
                        }`} />
                        <p className="text-lg font-semibold text-gray-900 capitalize">
                          {propertyData.marketAnalysis.marketTrend} Market
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Avg. Days on Market</p>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-gray-600" />
                        <p className="text-lg font-semibold text-gray-900">
                          {propertyData.marketAnalysis.daysOnMarket} days
                        </p>
                      </div>
                    </div>

                    {propertyData.marketAnalysis.estimatedRentalIncome && (
                      <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-600">
                        <p className="text-sm text-gray-600 mb-1">Est. Monthly Rental Income</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatCurrency(propertyData.marketAnalysis.estimatedRentalIncome)}/mo
                        </p>
                      </div>
                    )}
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-3">Comparable Properties:</h3>
                  <div className="space-y-3">
                    {propertyData.marketAnalysis.comparables.map((comp, index) => (
                      <div key={index} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">{comp.address}</p>
                          <p className="text-sm text-gray-600">{comp.sqft.toLocaleString()} sqft • {comp.distance}</p>
                        </div>
                        <p className="text-lg font-semibold text-blue-600">
                          {formatCurrency(comp.price)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Analysis */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <PiggyBank className="w-6 h-6 text-green-600 mt-1" />
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                    Financial Analysis
                  </h2>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Total Investment</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(propertyData.financialAnalysis.totalInvestment)}
                      </p>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-600">
                      <p className="text-sm text-gray-600 mb-1">Estimated Profit</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(propertyData.financialAnalysis.estimatedProfit)}
                      </p>
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Profit Margin</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatPercent(propertyData.financialAnalysis.profitMargin)}
                      </p>
                    </div>
                    
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Return on Investment (ROI)</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {formatPercent(propertyData.financialAnalysis.roi)}
                      </p>
                    </div>
                    
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Break-Even Price</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {formatCurrency(propertyData.financialAnalysis.breakEvenPrice)}
                      </p>
                    </div>

                    {propertyData.financialAnalysis.capRate && (
                      <div className="bg-indigo-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Cap Rate (If Rental)</p>
                        <p className="text-2xl font-bold text-indigo-600">
                          {formatPercent(propertyData.financialAnalysis.capRate)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tax Information */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <FileText className="w-6 h-6 text-orange-600 mt-1" />
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                    Property Tax Information
                  </h2>
                  
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Annual Property Tax</p>
                      <p className="text-xl font-bold text-orange-600">
                        {formatCurrency(propertyData.taxInfo.annualPropertyTax)}
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Tax Rate</p>
                      <p className="text-xl font-bold text-gray-900">
                        {formatPercent(propertyData.taxInfo.taxRate)}
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Assessed Value</p>
                      <p className="text-xl font-bold text-gray-900">
                        {formatCurrency(propertyData.taxInfo.assessedValue)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations & Risks */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Recommendations */}
              <div className="bg-green-50 border border-green-200 rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    Recommendations
                  </h2>
                </div>
                <ul className="space-y-3">
                  {propertyData.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0" />
                      <span className="text-gray-700">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Risks */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    Risk Factors
                  </h2>
                </div>
                <ul className="space-y-3">
                  {propertyData.risks.map((risk, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-yellow-600 rounded-full mt-2 flex-shrink-0" />
                      <span className="text-gray-700">{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="bg-gray-100 border border-gray-300 rounded-lg p-6">
              <p className="text-sm text-gray-700">
                <strong>Important Disclaimer:</strong> This analysis is for informational and planning purposes only. 
                Actual costs, market values, and financial returns may vary significantly based on market conditions, 
                location-specific factors, contractor pricing, material costs, and other variables. Always consult with 
                licensed professionals including real estate agents, contractors, architects, and financial advisors 
                before making investment decisions. Premier Holdings LLC is not responsible for any financial decisions 
                made based on this analysis.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
