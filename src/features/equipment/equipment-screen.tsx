"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
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
} from "lucide-react";

import {
  PageContainer,
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/shared/states";
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
  category: Category;
  maintenanceRecords: MaintenanceRecord[];
};

const schema = z.object({
  categoryId: z.string().min(1, "Pick a category"),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  nickname: z.string().optional(),
  purchaseDate: z.string().optional(),
  notes: z.string().optional(),
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
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const equipment = useApi<{ equipment: Equipment[] }>(
    ["customer", "equipment"],
    "/api/customer/equipment",
    { enabled: status === "authenticated" }
  );
  const categories = useApi<{ categories: Category[] }>(
    ["equipment-categories"],
    "/api/equipment-categories",
    { enabled: open }
  );

  const createMut = useApiMutation<{ equipment: Equipment }, FormValues>(
    "/api/customer/equipment",
    "POST"
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
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      await createMut.mutateAsync(values);
      toast.success("Equipment added");
      setOpen(false);
      form.reset();
    } catch (e: any) {
      toast.error("Could not add equipment", { description: e?.message });
    }
  }

  async function onDelete(id: string) {
    try {
      await apiFetch(`/api/customer/equipment/${id}`, { method: "DELETE" });
      toast.success("Equipment removed");
      // Invalidate via a quick refetch trigger.
      equipment.refetch();
    } catch (e: any) {
      toast.error("Could not delete", { description: e?.message });
    } finally {
      setDeleteId(null);
    }
  }

  if (status === "loading") {
    return (
      <PageContainer>
        <LoadingState />
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

  return (
    <PageContainer>
      <PageHeader
        title="My equipment"
        description="Register your appliances for faster diagnoses and warranty tracking."
        actions={
          <Button
            onClick={() => {
              form.reset();
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add equipment
          </Button>
        }
      />

      {equipment.isLoading ? (
        <LoadingState label="Loading equipment…" />
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((eq) => {
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
                      className="flex-1"
                      onClick={() =>
                        navigate(
                          `diagnose?equipmentId=${eq.id}&categoryId=${eq.category.id}`
                        )
                      }
                    >
                      <Stethoscope className="h-4 w-4" aria-hidden />
                      Report a problem
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label={`Delete ${eq.nickname || eq.category.name}`}
                      onClick={() => setDeleteId(eq.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add equipment</DialogTitle>
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
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="Anything you want to remember…"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Tag;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="truncate text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

export default EquipmentScreen;
