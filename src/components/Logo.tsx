
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "xxl";
}

const LOGO_BUCKET = 'branding';
const LOGO_PATH = 'logo/ophtacare-logo.png';
const FALLBACK_SRC = "/lovable-uploads/43c39c6c-3c4c-4d3c-bf99-696a345b96e1.png";

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
    sm: { wrapper: "w-10 h-10", img: "h-8 w-8" },
    md: { wrapper: "w-12 h-12", img: "h-10 w-10" },
    lg: { wrapper: "w-16 h-16", img: "h-14 w-14" },
    xl: { wrapper: "w-20 h-20", img: "h-16 w-16" },
    xxl: { wrapper: "w-24 h-24", img: "h-20 w-20" },
  } as const;

  const wrapperSize = sizes[size].wrapper;
  const imgSize = sizes[size].img;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`relative ${wrapperSize} flex items-center justify-center`}>
        <img
          src={src}
          alt="Logo OphtaCare Hub – cercle rayonnant"
          className={`${imgSize} object-contain`}
          loading="lazy"
          onError={() => setSrc(FALLBACK_SRC)}
        />
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="text-lg font-bold text-gray-900">OphtaCare</span>
          <span className="text-xs text-blue-600 font-medium">HUB</span>
        </div>
      )}
    </div>
  );
};

