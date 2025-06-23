
import { validatePassword } from "@/utils/passwordValidation";
import { Check, X } from "lucide-react";

interface PasswordStrengthProps {
  password: string;
}

export const PasswordStrength = ({ password }: PasswordStrengthProps) => {
  const validation = validatePassword(password);
  
  if (!password) return null;
  
  const requirements = [
    { test: password.length >= 8, text: "Au moins 8 caractères" },
    { test: /[A-Z]/.test(password), text: "Une majuscule" },
    { test: /[a-z]/.test(password), text: "Une minuscule" },
    { test: /[0-9]/.test(password), text: "Un chiffre" },
    { test: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password), text: "Un caractère spécial" }
  ];
  
  return (
    <div className="mt-2 space-y-1">
      <div className="text-sm font-medium text-gray-700">
        Exigences du mot de passe :
      </div>
      {requirements.map((req, index) => (
        <div key={index} className="flex items-center space-x-2 text-sm">
          {req.test ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <X className="h-4 w-4 text-red-500" />
          )}
          <span className={req.test ? "text-green-600" : "text-red-500"}>
            {req.text}
          </span>
        </div>
      ))}
    </div>
  );
};
