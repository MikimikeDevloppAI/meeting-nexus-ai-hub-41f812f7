
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "xxl" | "auth";
}

const LOGO_BUCKET = 'branding';
const LOGO_PATH = 'logo/ophtacare-logo.png';
const FALLBACK_SRC = "/lovable-uploads/8ce318ba-8c34-4795-bcd0-3b4ca32a9da8.png";

export const Logo = ({ className = "", showText = true, size = "md" }: LogoProps) => {
  const [src, setSrc] = useState<string>(FALLBACK_SRC);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // Try to use the most recently updated file in branding/logo
        const { data: files, error } = await supabase.storage
          .from(LOGO_BUCKET)
          .list('logo', { limit: 1, sortBy: { column: 'updated_at', order: 'desc' } });

        let resolvedPath = LOGO_PATH;
        if (!error && files && files.length > 0) {
          resolvedPath = `logo/${files[0].name}`;
        }

        const { data } = supabase.storage
          .from(LOGO_BUCKET)
          .getPublicUrl(resolvedPath);

        const publicUrl = data.publicUrl;
        if (!cancelled) setSrc(`${publicUrl}?v=${Date.now()}`);
      } catch (e) {
        if (!cancelled) setSrc(FALLBACK_SRC);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const sizes = {
    sm: { wrapper: "w-10 h-15", img: "h-8 w-8" },
    md: { wrapper: "w-12 h-12", img: "h-10 w-10" },
    lg: { wrapper: "w-16 h-16", img: "h-14 w-14" },
    xl: { wrapper: "w-20 h-20", img: "h-16 w-16" },
    xxl: { wrapper: "w-24 h-24", img: "h-20 w-20" },
    auth: { wrapper: "w-32 h-32", img: "h-28 w-28" },
  } as const;

  const wrapperSize = sizes[size].wrapper;
  const imgSize = sizes[size].img;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showText && (
        <>
          	<img
            src="/lovable-uploads/c22506f3-bb81-420d-800e-b3eb3f527868.png"
            alt="OphtaCare Hub Logo"
            className={size === "auth" ? "h-20 w-20 object-contain" : "h-12 w-12 object-contain"}
            loading="lazy"
          />
          <div className="flex flex-col leading-tight">
            <span className={size === "auth" ? "text-3xl font-bold text-foreground" : "text-xl font-bold text-foreground"}>OphtaCare</span>
            <span className={size === "auth" ? "text-3xl text-primary font-bold" : "text-xl text-primary font-bold"}>Hub</span>
          </div>
        </>
      )}
    </div>
  );
};

