
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const NotApproved = () => {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-accent p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary">NexusHub</h1>
          <p className="text-muted-foreground">Internal Management System</p>
        </div>
        <div className="bg-card p-8 rounded-lg shadow-lg animate-scale-in">
          <div className="h-16 w-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-6">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-8 w-8 text-yellow-500" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2}
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Account Awaiting Approval</h2>
          <p className="text-muted-foreground mb-6">
            Your account is currently pending administrator approval. You'll receive an email notification once your account has been approved.
          </p>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If you have any questions, please contact the system administrator.
            </p>
            <Button variant="outline" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotApproved;
