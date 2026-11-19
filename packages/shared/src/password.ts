/**
 * Règles d'un nouveau mot de passe, vérifiées en direct à l'écran (maquette v2 22) : mêmes seuils que
 * `passwordSchema` (10 à 72 caractères, des lettres et des chiffres), qui reste la vérification du serveur.
 */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72;

export type PasswordRules = { length: boolean; mix: boolean; match: boolean };

export function passwordRules(password: string, confirm: string): PasswordRules {
  return {
    length: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
    mix: /[A-Za-z]/.test(password) && /\d/.test(password),
    match: password.length > 0 && password === confirm,
  };
}

/** Part des règles respectées (0 à 1), pour la barre de progression. */
export function passwordProgress(rules: PasswordRules): number {
  return [rules.length, rules.mix, rules.match].filter(Boolean).length / 3;
}
