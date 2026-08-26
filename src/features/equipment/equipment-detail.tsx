"use client";

import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { 
  PageContainer, 
  PageHeader, 
  DetailSkeleton, 
  ErrorState 
} from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { navigate } from "@/store/router";
import { ArrowLeft, Stethoscope, Tag, Hash, Calendar, StickyNote } from "lucide-react";
import { formatDate } from "@/lib/format";

type EquipmentDetail = {
  id: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  nickname?: string | null;
  notes?: string | null;
  purchaseDate?: string | null;
  imageUrls: string[];
  category: {
    id: string;
    slug: string;
    name: string;
  };
  maintenanceRecords: any[];
  problemReports: any[];
};

export function EquipmentDetailScreen({ equipmentId }: { equipmentId: string }) {
  const { status } = useSession();

  const { data, isLoading, error } = useApi<{ equipment: EquipmentDetail }>(
    ["customer", "equipment", equipmentId],
    `/api/customer/equipment/${equipmentId}`,
    { enabled: !!equipmentId && status === "authenticated" }
  );

  if (isLoading || status === "loading") {
    return <PageContainer><DetailSkeleton /></PageContainer>;
  }

  if (error || !data?.equipment) {
    return <PageContainer><ErrorState detail={error?.message || "Equipment not found"} onRetry={() => navigate("equipment")} /></PageContainer>;
  }

  const eq = data.equipment;

  return (
    <PageContainer>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("equipment")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      <PageHeader 
        title={eq.nickname || eq.category.name}
        description={eq.category.name}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`technicians?categoryId=${eq.category.id}`)}>
              Consult Technician
            </Button>
            <Button onClick={() => navigate(`diagnose?equipmentId=${eq.id}&categoryId=${eq.category.id}`)}>
              <Stethoscope className="h-4 w-4 mr-2" /> Report Problem
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Equipment Specs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              {eq.brand && (
                <div>
                  <dt className="text-muted-foreground flex items-center gap-1"><Tag className="h-4 w-4" /> Brand</dt>
                  <dd className="font-medium mt-1">{eq.brand}</dd>
                </div>
              )}
              {eq.model && (
                <div>
                  <dt className="text-muted-foreground flex items-center gap-1"><Tag className="h-4 w-4" /> Model</dt>
                  <dd className="font-medium mt-1">{eq.model}</dd>
                </div>
              )}
              {eq.serialNumber && (
                <div>
                  <dt className="text-muted-foreground flex items-center gap-1"><Hash className="h-4 w-4" /> Serial</dt>
                  <dd className="font-medium mt-1">{eq.serialNumber}</dd>
                </div>
              )}
              {eq.purchaseDate && (
                <div>
                  <dt className="text-muted-foreground flex items-center gap-1"><Calendar className="h-4 w-4" /> Purchased</dt>
                  <dd className="font-medium mt-1">{formatDate(eq.purchaseDate)}</dd>
                </div>
              )}
            </dl>
            {eq.notes && (
              <div className="flex gap-2 p-3 bg-muted/50 rounded-md text-sm">
                <StickyNote className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p>{eq.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {eq.imageUrls?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Media</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {eq.imageUrls.map(url => (
                  <img key={url} src={url.startsWith("http") || url.startsWith("/") ? url : `/api/uploads/${url}`} alt="Equipment" className="rounded-md border object-cover w-full h-32" />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Repair History</CardTitle>
          </CardHeader>
          <CardContent>
            {eq.problemReports?.length > 0 ? (
              <div className="space-y-4">
                {eq.problemReports.map(pr => (
                  <div key={pr.id} className="flex justify-between items-center p-3 border rounded-md">
                    <div>
                      <p className="font-medium text-sm">{pr.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(pr.createdAt)} • Status: {pr.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No repair history available.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
