
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
    sm: { wrapper: "w-15 h-15", img: "h-12 w-12" },
    md: { wrapper: "w-18 h-18", img: "h-15 w-15" },
    lg: { wrapper: "w-30 h-30", img: "h-24 w-24" },
    xl: { wrapper: "w-42 h-42", img: "h-36 w-36" },
    xxl: { wrapper: "w-48 h-48", img: "h-42 w-42" },
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

