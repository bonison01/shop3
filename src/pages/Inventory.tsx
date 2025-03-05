
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/utils/format";
import { 
  Package, 
  Plus, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Edit, 
  Trash, 
  Download,
  Upload,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import AddProductForm from "@/components/forms/AddProductForm";
import EditProductForm from "@/components/forms/EditProductForm";
import * as XLSX from 'xlsx';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  category_type?: string | null;
  description?: string | null;
  price: number;
  wholesale_price?: number | null;
  retail_price?: number | null;
  trainer_price?: number | null;
  purchased_price?: number | null;
  stock: number;
  threshold: number;
  image_url?: string | null;
  created_at?: string | null;
  last_updated?: string | null;
}

interface ExcelRow {
  [key: string]: any;
  name?: string;
  Name?: string;
  sku?: string;
  SKU?: string;
  category_type?: string;
  Category_type?: string;
  price?: number | string;
  Price?: number | string;
  wholesale_price?: number | string;
  retail_price?: number | string;
  trainer_price?: number | string;
  purchased_price?: number | string;
  stock?: number | string;
  Stock?: number | string;
  threshold?: number | string;
  Threshold?: number | string;
  description?: string;
  Description?: string;
  image_url?: string;
}

const Inventory = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();
  
  const { data: products, isLoading, error, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      
      if (error) {
        toast({
          variant: "destructive",
          title: "Error fetching products",
          description: error.message,
        });
        throw error;
      }
      
      return data || [];
    },
  });

  const categoryTypes = products ? 
    ["all", ...Array.from(new Set(products.filter(p => p.category_type).map(product => product.category_type)))] : 
    ["all"];

  const filteredProducts = products?.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStock = 
      stockFilter === "all" || 
      (stockFilter === "in-stock" && product.stock > 0) ||
      (stockFilter === "low-stock" && product.stock <= product.threshold && product.stock > 0) ||
      (stockFilter === "out-of-stock" && product.stock === 0);
    
    return matchesSearch && matchesStock;
  });

  const getStockStatus = (product: Product) => {
    if (product.stock === 0) {
      return { label: "Out of Stock", variant: "destructive", icon: XCircle };
    } else if (product.stock <= product.threshold) {
      return { label: "Low Stock", variant: "warning", icon: AlertTriangle };
    } else {
      return { label: "In Stock", variant: "success", icon: CheckCircle };
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleAddProduct = () => {
    setAddDialogOpen(false);
    refetch();
  };

  const handleEditProduct = () => {
    setEditDialogOpen(false);
    refetch();
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', selectedProduct.id);
      
      if (error) throw error;
      
      toast({
        title: "Product Deleted",
        description: `${selectedProduct.name} has been removed from inventory.`,
      });
      
      refetch();
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to delete product",
      });
    }
  };

  const handleExportToExcel = () => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(products || []);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
      XLSX.writeFile(workbook, "inventory_export.xlsx");
      toast({
        title: "Export Successful",
        description: "Inventory has been exported to Excel",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: err.message || "Failed to export inventory",
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
    }
  };

  const handleImportFromExcel = async () => {
    if (!importFile) {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: "Please select a file to import",
      });
      return;
    }

    setIsImporting(true);

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];
        
        let successes = 0;
        let failures = 0;
        
        for (const item of jsonData) {
          try {
            const product = {
              name: item.name || item.Name || '',
              sku: item.sku || item.SKU || '',
              category: 'Default', // Using default category
              category_type: item.category_type || item.Category_type || null,
              price: parseFloat(String(item.price || item.Price || 0)),
              wholesale_price: item.wholesale_price ? parseFloat(String(item.wholesale_price)) : null,
              retail_price: item.retail_price ? parseFloat(String(item.retail_price)) : null,
              trainer_price: item.trainer_price ? parseFloat(String(item.trainer_price)) : null,
              purchased_price: item.purchased_price ? parseFloat(String(item.purchased_price)) : null,
              stock: parseInt(String(item.stock || item.Stock || 0)),
              threshold: parseInt(String(item.threshold || item.Threshold || 5)),
              description: item.description || item.Description || null,
              image_url: item.image_url || null
            };
            
            if (!product.name || !product.sku) {
              throw new Error(`Missing required fields for product: ${product.name || 'Unknown'}`);
            }
            
            const { data: existingProduct } = await supabase
              .from('products')
              .select('id')
              .eq('sku', product.sku)
              .maybeSingle();
            
            if (existingProduct) {
              const { error } = await supabase
                .from('products')
                .update(product)
                .eq('id', existingProduct.id);
              
              if (error) throw error;
            } else {
              const { error } = await supabase
                .from('products')
                .insert(product);
              
              if (error) throw error;
            }
            
            successes++;
          } catch (itemError) {
            console.error("Error processing item:", item, itemError);
            failures++;
          }
        }
        
        if (successes > 0) {
          toast({
            title: "Import Results",
            description: `Successfully processed ${successes} products. ${failures > 0 ? `Failed to process ${failures} products.` : ''}`,
          });
          
          refetch();
        } else if (failures > 0) {
          toast({
            variant: "destructive",
            title: "Import Failed",
            description: `Failed to process ${failures} products. Please check the file format.`,
          });
        } else {
          toast({
            variant: "destructive",
            title: "Import Failed",
            description: "No products found in the uploaded file.",
          });
        }
        
        setImportDialogOpen(false);
        setImportFile(null);
        setIsImporting(false);
      };
      
      reader.onerror = () => {
        throw new Error("Failed to read the file");
      };
      
      reader.readAsArrayBuffer(importFile);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: err.message || "Failed to import inventory",
      });
      setIsImporting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex flex-1 flex-col">
        <Navbar toggleSidebar={toggleSidebar} />
        
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-1">Inventory</h1>
              <p className="text-muted-foreground">Manage your product inventory</p>
            </div>
            <div className="flex flex-wrap gap-2 mt-4 sm:mt-0">
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Add New Product</DialogTitle>
                    <DialogDescription>
                      Fill in the details to add a new product to your inventory.
                    </DialogDescription>
                  </DialogHeader>
                  <AddProductForm onSuccess={handleAddProduct} />
                </DialogContent>
              </Dialog>
              
              <Button variant="outline" onClick={handleExportToExcel}>
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
              
              <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Excel
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Inventory from Excel</DialogTitle>
                    <DialogDescription>
                      Upload an Excel file to import or update products. The file should contain the columns described below.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="excel-file">Excel File</Label>
                      <Input 
                        id="excel-file" 
                        type="file" 
                        accept=".xlsx,.xls"
                        onChange={handleFileChange}
                      />
                    </div>
                    
                    <div className="text-sm space-y-2">
                      <div className="flex items-center text-primary">
                        <Info className="h-4 w-4 mr-1" />
                        <span className="font-semibold">Column Mapping Guide</span>
                      </div>
                      
                      <div className="border rounded-md p-3 space-y-3">
                        <div>
                          <p className="font-medium mb-1">Required Columns:</p>
                          <ul className="list-disc pl-5 space-y-1">
                            <li><span className="font-semibold">name</span> or <span className="font-semibold">Name</span>: Product name</li>
                            <li><span className="font-semibold">sku</span> or <span className="font-semibold">SKU</span>: Unique product code</li>
                          </ul>
                        </div>
                        
                        <div>
                          <p className="font-medium mb-1">Optional Columns:</p>
                          <ul className="list-disc pl-5 space-y-1">
                            <li><span className="font-semibold">category_type</span> or <span className="font-semibold">Category_type</span>: Type of product category</li>
                            <li><span className="font-semibold">price</span> or <span className="font-semibold">Price</span>: Base price in INR</li>
                            <li><span className="font-semibold">wholesale_price</span>: Wholesale price in INR</li>
                            <li><span className="font-semibold">retail_price</span>: Retail price in INR</li>
                            <li><span className="font-semibold">trainer_price</span>: Trainer price in INR</li>
                            <li><span className="font-semibold">purchased_price</span>: Purchase cost in INR</li>
                            <li><span className="font-semibold">stock</span> or <span className="font-semibold">Stock</span>: Current inventory quantity</li>
                            <li><span className="font-semibold">threshold</span> or <span className="font-semibold">Threshold</span>: Low stock alert level</li>
                            <li><span className="font-semibold">description</span> or <span className="font-semibold">Description</span>: Product details</li>
                            <li><span className="font-semibold">image_url</span>: URL to product image</li>
                          </ul>
                        </div>
                        
                        <div>
                          <p className="font-medium mb-1">Data Processing:</p>
                          <ul className="list-disc pl-5 space-y-1">
                            <li>Products are matched by SKU - existing products will be updated</li>
                            <li>New products (with unique SKUs) will be created</li>
                            <li>Price fields must contain numeric values</li>
                            <li>Stock and threshold must be whole numbers</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleImportFromExcel} disabled={!importFile || isImporting}>
                      {isImporting ? "Importing..." : "Import"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-grow">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search products by name or SKU..."
                  className="pl-8 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-48">
                <select 
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value)}
                >
                  <option value="all">All Stock Status</option>
                  <option value="in-stock">In Stock</option>
                  <option value="low-stock">Low Stock</option>
                  <option value="out-of-stock">Out of Stock</option>
                </select>
              </div>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-pulse">Loading inventory...</div>
            </div>
          ) : error ? (
            <div className="text-center text-red-500">
              Error loading inventory. Please try again.
            </div>
          ) : filteredProducts?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border rounded-lg bg-card">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No products found</p>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Product
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts?.map((product: Product) => {
                const stockStatus = getStockStatus(product);
                return (
                  <Card key={product.id} className="overflow-hidden">
                    <div className="h-3 bg-primary w-full"></div>
                    <CardHeader className="p-4 pb-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="line-clamp-1" title={product.name}>
                            {product.name}
                          </CardTitle>
                          <CardDescription>
                            SKU: {product.sku}
                          </CardDescription>
                        </div>
                        <Badge variant={
                          stockStatus.variant === "success" ? "default" : 
                          stockStatus.variant === "warning" ? "secondary" : 
                          "destructive"
                        }>
                          <stockStatus.icon className="h-3 w-3 mr-1" /> 
                          {stockStatus.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-2 text-sm">
                        {product.category_type && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Type:</span>
                            <span className="font-medium">{product.category_type}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Price:</span>
                          <span className="font-medium">{formatCurrency(product.price)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Stock:</span>
                          <span className="font-medium">{product.stock} units</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mt-4">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => {
                            setSelectedProduct(product);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 text-red-500 hover:text-red-600"
                          onClick={() => {
                            setSelectedProduct(product);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete {selectedProduct?.name}? 
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button variant="destructive" onClick={handleDeleteProduct}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Edit Product</DialogTitle>
                <DialogDescription>
                  Update the details of your product.
                </DialogDescription>
              </DialogHeader>
              {selectedProduct && (
                <EditProductForm 
                  product={selectedProduct} 
                  onSuccess={handleEditProduct} 
                  onCancel={() => setEditDialogOpen(false)} 
                />
              )}
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
};

export default Inventory;
