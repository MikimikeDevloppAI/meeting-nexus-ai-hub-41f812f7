
export const cleanFileName = (fileName: string): string => {
  // Extraire le nom et l'extension
  const lastDotIndex = fileName.lastIndexOf('.');
  const name = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
  const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';

  // Nettoyer le nom
  let cleanedName = name
    // Remplacer les caractères spéciaux par des tirets ou les supprimer
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
    // Remplacer les espaces et caractères spéciaux par des tirets
    .replace(/[\s\-_]+/g, '-')
    // Supprimer tous les autres caractères non alphanumériques sauf les tirets
    .replace(/[^a-zA-Z0-9\-]/g, '')
    // Supprimer les tirets multiples
    .replace(/-+/g, '-')
    // Supprimer les tirets au début et à la fin
    .replace(/^-+|-+$/g, '');

  // Limiter la longueur du nom (max 100 caractères)
  if (cleanedName.length > 100) {
    cleanedName = cleanedName.substring(0, 100);
  }

  // S'assurer qu'il y a au moins un caractère
  if (cleanedName.length === 0) {
    cleanedName = 'document';
  }

  return cleanedName + extension.toLowerCase();
};

export const validateFileName = (fileName: string): { isValid: boolean; issues: string[] } => {
  const issues: string[] = [];

  // Vérifier les caractères problématiques
  if (/[^\w\-_.]/g.test(fileName.replace(/\.[^.]*$/, ''))) {
    issues.push('Contient des caractères spéciaux qui peuvent causer des problèmes');
  }

  // Vérifier les espaces
  if (/\s/.test(fileName)) {
    issues.push('Contient des espaces');
  }

  // Vérifier la longueur
  if (fileName.length > 150) {
    issues.push('Le nom est trop long (plus de 150 caractères)');
  }

  return {
    isValid: issues.length === 0,
    issues
  };
};
