
import { Logo } from "@/components/Logo";

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-accent">
      <div className="text-center p-6 max-w-md">
        <div className="mb-6">
          <Logo className="justify-center" />
        </div>
        <div className="animate-pulse h-6 w-36 bg-primary/20 rounded-full mx-auto mb-4"></div>
        <p className="text-muted-foreground">Chargement de l'application...</p>
      </div>
    </div>
  );
};

export default Index;
