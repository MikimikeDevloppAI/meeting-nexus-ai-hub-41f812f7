
import React from "react";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

export const MobileSidebarToggle: React.FC = () => {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleSidebar}
      aria-label="Ouvrir la navigation"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
};

export default MobileSidebarToggle;

