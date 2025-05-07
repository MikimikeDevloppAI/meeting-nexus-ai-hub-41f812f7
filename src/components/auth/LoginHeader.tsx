
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const LoginHeader = () => {
  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-primary">NexusHub</h1>
        <p className="text-muted-foreground">Internal Management System</p>
      </div>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Sign In</CardTitle>
        <CardDescription>
          Enter your credentials below to access your account
        </CardDescription>
      </CardHeader>
    </>
  );
};
