
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

const LOGO_BUCKET = 'branding';
const LOGO_PATH = 'logo/ophtacare-logo.png';
const FALLBACK_SRC = "/lovable-uploads/77aa08c4-c4d2-410d-b176-9a564fe9a881.png";

export const Logo = ({ className = "", showText = true }: LogoProps) => {
  const [src, setSrc] = useState<string>(FALLBACK_SRC);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = supabase.storage
          .from(LOGO_BUCKET)
          .getPublicUrl(LOGO_PATH);

        const publicUrl = data.publicUrl;
        // Always upsert the logo with the provided source to ensure latest branding
        const sourceUrl = `${window.location.origin}${FALLBACK_SRC}`;
        await fetch(`https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/seed-branding-logo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_url: sourceUrl, target_path: LOGO_PATH })
        });

        if (!cancelled) setSrc(publicUrl);
      } catch (e) {
        if (!cancelled) setSrc(FALLBACK_SRC);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative w-12 h-12 flex items-center justify-center">
        <img
          src={src}
          alt="Logo OphtaCare Hub – cercle rayonnant"
          className="h-10 w-10 object-contain"
          loading="lazy"
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

