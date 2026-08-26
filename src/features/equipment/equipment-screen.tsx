"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Calendar,
  Tag,
  Hash,
  StickyNote,
  AlertTriangle,
  Stethoscope,
  Image as ImageIcon,
} from "lucide-react";

import {
  PageContainer,
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  GridSkeleton,
} from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useApi, useApiMutation, apiFetch } from "@/hooks/use-api";
import { navigate } from "@/store/router";
import { formatDate } from "@/lib/format";
import { MediaUploader } from "@/components/shared/media-uploader";
import { ContextualSearch, type SearchResultItem } from "@/components/search/contextual-search";
import { scoreItem } from "@/lib/search/ranking";

type Category = {
  id: string;
  slug: string;
  name: string;
  icon?: string | null;
};

type MaintenanceRecord = {
  id: string;
  date: string;
  type: string;
  description?: string | null;
  cost?: number | null;
};

type Equipment = {
  id: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  nickname?: string | null;
  notes?: string | null;
  purchaseDate?: string | null;
  imageUrls: string[];
  customCategoryName?: string | null;
  category: Category;
  maintenanceRecords: MaintenanceRecord[];
};

const schema = z.object({
  categoryId: z.string().min(1, "Pick a category"),
  customCategoryName: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  nickname: z.string().optional(),
  purchaseDate: z.string().optional(),
  notes: z.string().optional(),
  imageUrls: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

import {
  Wrench,
  WashingMachine,
  Refrigerator,
  Utensils,
  Microwave,
  Fan,
  Tv,
  Laptop,
  Cpu,
  Smartphone,
  Printer,
  Camera,
  Coffee,
  Shirt,
  Waves,
  Snowflake,
  type LucideIcon,
} from "lucide-react";

function Detail({ icon: Icon, label, value }: { icon: LucideIcon, label: string, value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      <span className="font-medium text-muted-foreground">{label}:</span>
      <span className="truncate">{value}</span>
    </div>
  );
}

function categoryIcon(slug?: string | null): LucideIcon {
  switch ((slug ?? "").toLowerCase().replace(/[-\s]/g, "_")) {
    case "washing_machine":
    case "washer": return WashingMachine;
    case "refrigerator":
    case "fridge":
    case "freezer": return Refrigerator;
    case "dishwasher": return Utensils;
    case "microwave": return Microwave;
    case "air_conditioner":
    case "ac":
    case "aircon": return Fan;
    case "tv":
    case "television": return Tv;
    case "laptop": return Laptop;
    case "computer":
    case "desktop": return Cpu;
    case "smartphone":
    case "phone": return Smartphone;
    case "printer": return Printer;
    case "camera": return Camera;
    case "coffee_maker":
    case "coffeemaker": return Coffee;
    case "shirt":
    case "clothing": return Shirt;
    case "waves": return Waves;
    case "snowflake": return Snowflake;
    default: return Wrench;
  }
}

export function EquipmentScreen() {
  const { status } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingEq, setEditingEq] = useState<Equipment | null>(null);
  const [search, setSearch] = useState("");

  const equipment = useApi<{ equipment: Equipment[] }>(
    ["customer", "equipment"],
    "/api/customer/equipment",
    { enabled: status === "authenticated" }
  );
  const categories = useApi<{ categories: Category[] }>(
    ["equipment-categories"],
    "/api/equipment-categories",
    { enabled: open, staleTime: 24 * 60 * 60 * 1000 }
  );

  const createMut = useApiMutation<{ equipment: Equipment }, FormValues>(
    "/api/customer/equipment",
    "POST",
    [["customer", "equipment"]],
    {
      queryKey: ["customer", "equipment"],
      updater: (oldData: any, newVars: FormValues) => {
        if (!oldData || !oldData.equipment) return oldData;
        const tempEq: Equipment = {
          id: `temp-${Date.now()}`,
          category: categories.data?.categories.find(c => c.id === newVars.categoryId) ?? { id: "unknown", slug: "unknown", name: "Unknown" },
          brand: newVars.brand ?? null,
          model: newVars.model ?? null,
          serialNumber: newVars.serialNumber ?? null,
          nickname: newVars.nickname ?? null,
          purchaseDate: newVars.purchaseDate ? new Date(newVars.purchaseDate).toISOString() : null,
          notes: newVars.notes ?? null,
          imageUrls: [],
          maintenanceRecords: []
        };
        return {
          ...oldData,
          equipment: [tempEq, ...oldData.equipment]
        };
      }
    }
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      categoryId: "",
      brand: "",
      model: "",
      serialNumber: "",
      nickname: "",
      purchaseDate: "",
      notes: "",
      imageUrls: [] as string[],
      customCategoryName: "",
    },
  });

  const [imageUrls, setImageUrls] = useState<string[]>([]);

  function onSubmit(values: FormValues) {
    const payload = {
      ...values,
      imageUrls: imageUrls,
    };
    
    if (editingEq) {
      // 1. Cancel outgoing refetches
      qc.cancelQueries({ queryKey: ["customer", "equipment"] });
      // 2. Snapshot previous
      const previous = qc.getQueryData(["customer", "equipment"]);
      // 3. Optimistic update
      qc.setQueryData(["customer", "equipment"], (oldData: any) => {
        if (!oldData || !oldData.equipment) return oldData;
        return {
          ...oldData,
          equipment: oldData.equipment.map((eq: any) => 
            eq.id === editingEq.id ? { ...eq, ...payload, category: categories.data?.categories.find(c => c.id === payload.categoryId) ?? eq.category } : eq
          )
        };
      });

      // 4. Server request
      apiFetch(`/api/customer/equipment/${editingEq.id}`, { 
        method: "PATCH", 
        body: JSON.stringify(payload) 
      }).then(() => {
        toast.success("Equipment updated");
        // 6. Reconcile
        qc.invalidateQueries({ queryKey: ["customer", "equipment"] });
      }).catch(e => {
        // 5. Rollback
        if (previous) qc.setQueryData(["customer", "equipment"], previous);
        toast.error("Could not update equipment", { description: e?.message });
        qc.invalidateQueries({ queryKey: ["customer", "equipment"] });
      });
    } else {
      createMut.mutate(payload, {
        onSuccess: () => {
          toast.success("Equipment added");
        },
        onError: (e: any) => toast.error("Could not add equipment", { description: e?.message })
      });
    }
    
    // Close modal instantly
    setOpen(false);
    form.reset();
    setImageUrls([]);
    setEditingEq(null);
  }

  function onDelete(id: string) {
    // 1. Cancel
    qc.cancelQueries({ queryKey: ["customer", "equipment"] });
    // 2. Snapshot
    const previous = qc.getQueryData(["customer", "equipment"]);
    // 3. Optimistic update
    qc.setQueryData(["customer", "equipment"], (oldData: any) => {
      if (!oldData || !oldData.equipment) return oldData;
      return {
        ...oldData,
        equipment: oldData.equipment.filter((eq: any) => eq.id !== id)
      };
    });
    setDeleteId(null);
    
    // 4. Request
    apiFetch(`/api/customer/equipment/${id}`, { method: "DELETE" })
      .then(() => {
        toast.success("Equipment removed");
        // 6. Reconcile
        qc.invalidateQueries({ queryKey: ["customer", "equipment"] });
      })
      .catch(e => {
        // 5. Rollback
        if (previous) qc.setQueryData(["customer", "equipment"], previous);
        toast.error("Could not delete", { description: e?.message });
        qc.invalidateQueries({ queryKey: ["customer", "equipment"] });
      });
  }

  if (status === "loading") {
    return (
      <PageContainer>
        <GridSkeleton />
      </PageContainer>
    );
  }

  if (status !== "authenticated") {
    return (
      <PageContainer>
        <EmptyState
          icon={Wrench}
          title="Sign in to manage your equipment"
          description="Register appliances, electronics, and tools to start diagnoses faster."
          action={<Button onClick={() => navigate("auth/signin")}>Sign in</Button>}
        />
      </PageContainer>
    );
  }

  const items = equipment.data?.equipment ?? [];
  
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim();
    
    return items
      .map(eq => {
        const score = scoreItem(q, [
          { name: "nickname", value: eq.nickname, weight: 2.0 },
          { name: "name", value: eq.category?.name, weight: 1.5 },
          { name: "brand", value: eq.brand, weight: 1.2 },
          { name: "model", value: eq.model, weight: 1.0 },
          { name: "serial", value: eq.serialNumber, weight: 1.0 },
        ]);
        return { eq, score: score.score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.eq);
  }, [items, search]);

  return (
    <PageContainer>
      <PageHeader
        title="My equipment"
        description="Register your appliances for faster diagnoses and warranty tracking."
        actions={
          <div className="flex items-center gap-2">
            <ContextualSearch
              queryKey="equipment-search"
              placeholder="Search my equipment..."
              className="w-64"
              onSearch={async (q) => {
                const qLower = q.trim();
                if (!qLower) return [];
                
                return items.map(eq => {
                  const score = scoreItem(qLower, [
                    { name: "nickname", value: eq.nickname, weight: 10.0 },
                    { name: "brand", value: eq.brand, weight: 5.0 },
                    { name: "model", value: eq.model, weight: 3.0 },
                    { name: "category", value: eq.category.name, weight: 1.0 },
                  ]);
                  return {
                    id: eq.id,
                    title: eq.nickname || `${eq.brand || ""} ${eq.model || ""}`.trim() || eq.category.name,
                    subtitle: eq.category.name,
                    score: score.score
                  };
                }).filter(x => x.score > 0)
                  .sort((a, b) => b.score - a.score);
              }}
              onSelect={(item) => {
                const eq = items.find(i => i.id === item.id);
                if (eq) {
                  setEditingEq(eq);
                  setOpen(true);
                }
              }}
            />
            <Dialog 
            open={open} 
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) {
                form.reset();
                setImageUrls([]);
                setEditingEq(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-2" aria-hidden />
                Add equipment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEq ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
                <DialogDescription>
                  Pick a category and fill in what you know. You can edit details
                  later.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  id="add-equipment-form"
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="flex flex-col gap-4"
                >
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.data?.categories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("categoryId") === "other" && (
                    <FormField
                      control={form.control}
                      name="customCategoryName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Custom Category Name</FormLabel>
                          <FormControl>
                            <Input placeholder="What is it?" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="brand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brand</FormLabel>
                          <FormControl>
                            <Input placeholder="LG, Samsung…" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormControl>
                            <Input placeholder="Model number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="serialNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Serial</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="purchaseDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purchase date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="nickname"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nickname</FormLabel>
                        <FormControl>
                          <Input placeholder='"Kitchen fridge"' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="e.g. Needs a new filter soon"
                              value={field.value || ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="space-y-2">
                      <FormLabel>Equipment Images (Optional)</FormLabel>
                      <MediaUploader
                        value={imageUrls}
                        onChange={setImageUrls}
                        maxFiles={4}
                      />
                    </div>
                </form>
              </Form>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="add-equipment-form"
                  disabled={createMut.isPending}
                >
                  {createMut.isPending ? "Saving…" : "Save equipment"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      {equipment.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                <div className="grid grid-cols-1 gap-3 mt-1">
                  <Skeleton className="h-4 w-full max-w-[200px]" />
                  <Skeleton className="h-4 w-full max-w-[160px]" />
                  <Skeleton className="h-4 w-full max-w-[180px]" />
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Skeleton className="h-9 flex-1 min-w-[120px]" />
                  <Skeleton className="h-9 flex-1 min-w-[120px]" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : equipment.error ? (
        <ErrorState
          detail={equipment.error.message}
          onRetry={() => equipment.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No equipment yet"
          description="Add your first appliance so FixIt can remember its model, serial, and warranty notes."
          action={
            <Button
              onClick={() => {
                form.reset();
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add your first equipment
            </Button>
          }
        />
      ) : filteredItems.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No equipment matches your search.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((eq) => {
            const Icon = categoryIcon(eq.category.slug);
            return (
              <Card key={eq.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <div>
                        <CardTitle className="text-base">
                          {eq.nickname || eq.category.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {eq.category.name}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                  <dl className="grid grid-cols-1 gap-2">
                    {eq.brand && (
                      <Detail icon={Tag} label="Brand" value={eq.brand} />
                    )}
                    {eq.model && (
                      <Detail icon={Tag} label="Model" value={eq.model} />
                    )}
                    {eq.serialNumber && (
                      <Detail
                        icon={Hash}
                        label="Serial"
                        value={eq.serialNumber}
                      />
                    )}
                    {eq.purchaseDate && (
                      <Detail
                        icon={Calendar}
                        label="Purchased"
                        value={formatDate(eq.purchaseDate)}
                      />
                    )}
                  </dl>
                  {eq.notes && (
                    <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                      <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="line-clamp-3">{eq.notes}</span>
                    </div>
                  )}

                  {eq.imageUrls && eq.imageUrls.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 mt-2">
                      {eq.imageUrls.map((url) => (
                        <img key={url} src={url.startsWith("http") || url.startsWith("/") ? url : `/api/uploads/${url}`} alt="Equipment" className="h-16 w-16 object-cover rounded-md border" />
                      ))}
                    </div>
                  )}

                  {eq.maintenanceRecords?.length > 0 && (
                    <div className="mt-1 border-t border-border pt-2">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Maintenance history
                      </p>
                      <ul className="flex flex-col gap-1 text-xs">
                        {eq.maintenanceRecords.slice(0, 3).map((m) => (
                          <li key={m.id} className="flex justify-between gap-2">
                            <span className="truncate capitalize">
                              {m.type.replace(/_/g, " ").toLowerCase()}
                              {m.description ? ` · ${m.description}` : ""}
                            </span>
                            <span className="shrink-0 text-muted-foreground">
                              {formatDate(m.date)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 min-w-[120px]"
                      onClick={() => navigate(`equipment/${eq.id}`)}
                    >
                      View Details
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 min-w-[120px]"
                      onClick={() => navigate(`technicians?categoryId=${eq.category.id}`)}
                    >
                      Consult Tech
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 min-w-[120px]"
                      onClick={() =>
                        navigate(
                          `diagnose?equipmentId=${eq.id}&categoryId=${eq.category.id}`
                        )
                      }
                    >
                      <Stethoscope className="h-4 w-4 mr-2" aria-hidden />
                      Report Problem
                    </Button>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit ${eq.nickname || eq.category.name}`}
                      onClick={() => {
                        setEditingEq(eq);
                        form.reset({
                          categoryId: eq.category.id || "",
                          brand: eq.brand || "",
                          model: eq.model || "",
                          serialNumber: eq.serialNumber || "",
                          nickname: eq.nickname || "",
                          purchaseDate: eq.purchaseDate ? new Date(eq.purchaseDate).toISOString().slice(0, 10) : "",
                          notes: eq.notes || "",
                          imageUrls: eq.imageUrls || [],
                          customCategoryName: eq.customCategoryName || "",
                        });
                        setImageUrls(eq.imageUrls || []);
                        setOpen(true);
                      }}
                    >
                      <Wrench className="h-4 w-4 mr-2" aria-hidden /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      aria-label={`Delete ${eq.nickname || eq.category.name}`}
                      onClick={() => setDeleteId(eq.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" aria-hidden /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}


      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
              Remove this equipment?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This also removes its diagnostic sessions and repair requests.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleteId && onDelete(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

export default EquipmentScreen;
