
import { Logo } from "@/components/Logo";

export const AuthBrand = () => {
  return (
    <div className="mb-8 text-center">
      <Logo className="justify-center mb-2" showText={false} size="xl" />
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">OphtaCare Hub</h1>
    </div>
  );
};
