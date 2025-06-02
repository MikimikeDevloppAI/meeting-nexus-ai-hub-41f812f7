
import { Eye } from "lucide-react";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export const Logo = ({ className = "", showText = true }: LogoProps) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <Eye className="h-8 w-8 text-blue-600" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
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
