
import { Eye } from "lucide-react";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export const Logo = ({ className = "", showText = true }: LogoProps) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative w-12 h-12 flex items-center justify-center">
        {/* Rayons du soleil */}
        <svg className="absolute inset-0 w-12 h-12" viewBox="0 0 48 48">
          {Array.from({ length: 24 }, (_, i) => {
            const angle = (i * 360) / 24;
            const radians = (angle * Math.PI) / 180;
            const startX = 24 + Math.cos(radians) * 14;
            const startY = 24 + Math.sin(radians) * 14;
            const endX = 24 + Math.cos(radians) * 22;
            const endY = 24 + Math.sin(radians) * 22;
            
            return (
              <line
                key={i}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="#2563eb"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        
        {/* Œil au centre */}
        <div className="relative z-10">
          <Eye className="h-8 w-8 text-blue-600" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
        </div>
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
