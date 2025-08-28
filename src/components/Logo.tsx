
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "xxl";
}

const LOGO_BUCKET = 'branding';
const LOGO_PATH = 'logo/ophtacare-logo.png';
const FALLBACK_SRC = "/lovable-uploads/5eb31ec3-a7d9-431f-b326-be18bb954a15.png";

export const Logo = ({ className = "", showText = true, size = "md" }: LogoProps) => {
  const [src, setSrc] = useState<string>(FALLBACK_SRC);

  useEffect(() => {
    // Use the new logo directly
    setSrc(FALLBACK_SRC);
  }, []);

  const sizes = {
    sm: { wrapper: "w-16 h-16", img: "h-14 w-14" },
    md: { wrapper: "w-20 h-20", img: "h-16 w-16" },
    lg: { wrapper: "w-24 h-24", img: "h-20 w-20" },
    xl: { wrapper: "w-32 h-32", img: "h-28 w-28" },
    xxl: { wrapper: "w-40 h-40", img: "h-32 w-32" },
  } as const;

  const wrapperSize = sizes[size].wrapper;
  const imgSize = sizes[size].img;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`relative ${wrapperSize} flex items-center justify-center`}>
        <img
          src={src}
          alt="OphtaCare HUB Logo"
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

