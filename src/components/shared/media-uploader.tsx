import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

interface MediaUploaderProps {
  value: string[];
  onChange: (value: string[]) => void;
  maxFiles?: number;
}

export function MediaUploader({ value, onChange, maxFiles = 3 }: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (value.length + files.length > maxFiles) {
      toast.error(`You can only upload up to ${maxFiles} files.`);
      return;
    }

    setUploading(true);
    const newUrls = [...value];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");
        
        const data = await res.json();
        if (data.url) {
          newUrls.push(data.url);
        }
      } catch (err: any) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    onChange(newUrls);
    setUploading(false);
    e.target.value = ""; // Reset input
  };

  const removeFile = (urlToRemove: string) => {
    onChange(value.filter((url) => url !== urlToRemove));
  };

  return (
    <div className="space-y-4">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {value.map((url) => (
            <div key={url} className="relative h-20 w-20 overflow-hidden rounded-md border border-border">
              {/* Note: In a real app, this might be a pdf thumbnail or image. We assume images here. */}
              {url.endsWith(".pdf") ? (
                <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                  PDF
                </div>
              ) : (
                <img src={`/api/uploads/${url}`} alt="Upload" className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeFile(url)}
                className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-destructive hover:bg-background"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {value.length < maxFiles && (
        <div className="flex items-center gap-2">
          <input
            type="file"
            id="media-upload"
            className="hidden"
            multiple
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => document.getElementById("media-upload")?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            Upload files
          </Button>
          <span className="text-xs text-muted-foreground">
            {value.length} / {maxFiles}
          </span>
        </div>
      )}
    </div>
  );
}
