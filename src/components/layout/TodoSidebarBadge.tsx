import { useTodoCounter } from "@/hooks/useTodoCounter";
import { Badge } from "@/components/ui/badge";

export const TodoSidebarBadge = () => {
  const todoCount = useTodoCounter();
  
  console.log('🔵 TodoSidebarBadge render - count:', todoCount);
  
  if (todoCount === 0) {
    console.log('🔵 TodoSidebarBadge - hiding badge (count is 0)');
    return null;
  }
  
  console.log('🔵 TodoSidebarBadge - showing badge with count:', todoCount);
  
  return (
    <Badge 
      variant="secondary" 
      className="bg-red-500 text-white font-medium text-xs px-2 py-0.5 rounded-full ml-auto"
    >
      {todoCount}
    </Badge>
  );
};