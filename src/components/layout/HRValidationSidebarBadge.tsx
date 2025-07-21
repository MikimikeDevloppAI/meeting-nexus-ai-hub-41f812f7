import { useHRValidationCounter } from "@/hooks/useHRValidationCounter";
import { Badge } from "@/components/ui/badge";

export const HRValidationSidebarBadge = () => {
  const validationCount = useHRValidationCounter();
  
  console.log('🟠 HRValidationSidebarBadge render - count:', validationCount);
  
  if (validationCount === 0) {
    console.log('🟠 HRValidationSidebarBadge - hiding badge (count is 0)');
    return null;
  }
  
  console.log('🟠 HRValidationSidebarBadge - showing badge with count:', validationCount);
  
  return (
    <Badge 
      variant="secondary" 
      className="bg-orange-500 text-white font-medium text-xs px-2 py-0.5 rounded-full ml-auto"
    >
      {validationCount}
    </Badge>
  );
};