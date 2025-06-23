
export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}

export const validatePassword = (password: string): PasswordValidation => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push("Le mot de passe doit contenir au moins 8 caractères");
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push("Le mot de passe doit contenir au moins une majuscule");
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push("Le mot de passe doit contenir au moins une minuscule");
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push("Le mot de passe doit contenir au moins un chiffre");
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password)) {
    errors.push("Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*...)");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const getPasswordStrengthColor = (password: string): string => {
  const validation = validatePassword(password);
  if (validation.isValid) return "text-green-600";
  if (password.length >= 6) return "text-orange-500";
  return "text-red-500";
};
