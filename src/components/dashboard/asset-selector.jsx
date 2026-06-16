"use client";

import { useState } from "react";
import { useAssets } from "@/hooks/use-assets";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, ImagePlus, UserCircle2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export function AssetSelector({ onSelect, type = "all", title = "Select Asset" }) {
  const { assets, avatars, productImages, loading } = useAssets();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const handleSelect = (asset) => {
    onSelect(asset);
    setOpen(false);
  };

  const filterAssets = (items) => {
    return items.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full flex items-center gap-2 py-8 bg-muted/20 border-dashed border-2 hover:bg-muted/30 transition-all">
          <ImagePlus className="w-5 h-5 text-muted-foreground" />
          <span className="text-muted-foreground">Select from Library</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl sm:h-[600px] flex flex-col p-0 overflow-hidden border-border/50 shadow-2xl">
        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle className="text-xl font-heading flex items-center gap-2">
            <UserCircle2 className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search your library..."
              className="pl-10 h-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-0">
          <Tabs defaultValue={type === "all" ? "avatars" : type} className="flex flex-col h-full">
            {type === "all" && (
              <div className="px-6 border-b">
                <TabsList className="bg-transparent gap-6 p-0 h-12">
                  <TabsTrigger 
                    value="avatars" 
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-full font-medium"
                  >
                    Avatars
                  </TabsTrigger>
                  <TabsTrigger 
                    value="products" 
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-full font-medium"
                  >
                    Product Images
                  </TabsTrigger>
                </TabsList>
              </div>
            )}

            <div className="flex-1 overflow-auto p-6 pt-4">
              <TabsContent value="avatars" className="m-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {loading ? (
                    [...Array(8)].map((_, i) => (
                      <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
                    ))
                  ) : filterAssets(avatars).length > 0 ? (
                    filterAssets(avatars).map((asset) => (
                      <AssetCard key={asset.id} asset={asset} onClick={() => handleSelect(asset)} />
                    ))
                  ) : (
                    <div className="col-span-full py-20 text-center text-muted-foreground">
                      No avatars found
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="products" className="m-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {loading ? (
                    [...Array(8)].map((_, i) => (
                      <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
                    ))
                  ) : filterAssets(productImages).length > 0 ? (
                    filterAssets(productImages).map((asset) => (
                      <AssetCard key={asset.id} asset={asset} onClick={() => handleSelect(asset)} />
                    ))
                  ) : (
                    <div className="col-span-full py-20 text-center text-muted-foreground">
                      No product images found
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssetCard({ asset, onClick }) {
  return (
    <Card 
      className="group cursor-pointer border-border/50 hover:border-primary/50 hover:shadow-md transition-all relative overflow-hidden"
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="aspect-square bg-muted relative">
          <img
            src={asset.url || asset.image_url}
            alt={asset.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
        </div>
        <div className="p-2">
          <p className="text-[10px] font-medium truncate text-center">{asset.name}</p>
        </div>
      </CardContent>
    </Card>
  );
}
