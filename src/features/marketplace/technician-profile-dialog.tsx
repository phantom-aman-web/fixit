import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BadgeCheck, Briefcase, Calendar, MessageSquare, Star, Timer } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { navigate } from "@/store/router";
import { formatCurrency } from "@/lib/format";
import { StatusBadge } from "@/components/shared/status-badges";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

export function TechnicianProfileDialog({ technicianId, children }: { technicianId: string, children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useApi<any>(
    ["technician", technicianId],
    `/api/technicians/${technicianId}`,
    { enabled: open }
  );

  const tech = data?.technician;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 border-b">
          <DialogTitle>Technician Profile</DialogTitle>
          <DialogDescription className="sr-only">Details about this technician</DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 p-6">
          {isLoading && <div className="py-12 text-center text-muted-foreground">Loading profile...</div>}
          {isError && <div className="py-12 text-center text-red-500">Could not load profile.</div>}
          
          {tech && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <Avatar className="h-20 w-20 border">
                  {tech.avatarUrl ? <AvatarImage src={tech.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="text-xl">{initials(tech.displayName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold tracking-tight">{tech.displayName}</h2>
                    {tech.verified && (
                      <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
                        <BadgeCheck className="h-3.5 w-3.5" /> Verified
                      </Badge>
                    )}
                    <StatusBadge status={tech.availability} />
                  </div>
                  
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="font-semibold text-foreground">{tech.rating.toFixed(1)}</span>
                      <span>({tech.ratingCount} reviews)</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="h-4 w-4" /> {tech.completedJobs} jobs
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" /> {tech.yearsExperience} yrs exp
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Timer className="h-4 w-4" /> ~{tech.responseTimeHours}h response
                    </span>
                  </div>
                  
                  {tech.bio && <p className="mt-3 text-sm">{tech.bio}</p>}
                  
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {tech.baseCallOutFee != null && (
                      <Badge variant="outline" className="font-medium">
                        Call-out fee {formatCurrency(tech.baseCallOutFee)}
                      </Badge>
                    )}
                    {tech.hourlyRate != null && (
                      <Badge variant="outline" className="font-medium">
                        {formatCurrency(tech.hourlyRate)}/hr
                      </Badge>
                    )}
                    {tech.phone && (
                      <Badge variant="secondary" className="font-medium">{tech.phone}</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Skills section summary */}
              {tech.skills && tech.skills.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">Skills & Expertise</h3>
                  <div className="flex flex-wrap gap-2">
                    {tech.skills.map((s: any) => (
                      <Badge key={s.id} variant="secondary">{s.skill}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
        
        {tech && (
          <div className="p-4 border-t bg-muted/20 flex justify-end gap-3 rounded-b-lg">
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <div className="relative group">
              <Button 
                onClick={() => navigate(`messages/new?technicianId=${tech.id}`)}
                disabled={!tech.canMessage}
              >
                <MessageSquare className="h-4 w-4 mr-2" /> Message
              </Button>
              {!tech.canMessage && (
                <div className="absolute left-1/2 -top-10 -translate-x-1/2 w-max px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                  Available after booking
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
