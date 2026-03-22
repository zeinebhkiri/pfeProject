export type UserRole = "SALARIE" | "MANAGER" | "ADMIN";

export type StatutCompte = "EN_ATTENTE" | "VALIDE" | "EXPIRE" | "DESACTIVE" | "ACCEPTE";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  email: string;
  role: UserRole;
  userId: string;
}

export interface ActivateAccountRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface TokenInfo {
  email: string;
  role: UserRole;
  prenom: string;
  nom: string;
}

export interface CreateEmployeeRequest {
  nom: string;
  prenom: string;
  email: string;
  role: UserRole;
  joursLimite: number;
}

export interface ProfileUpdateRequest {
  adresse: string;
  rib: string;
  telephone: string;
  image?: string;
    numeroCnss: string
  dateNaissance: string
  lieuNaissance: string
  nomBanque: string
  statutSocial: string
  nationalite: string
  genre: string
  photoPoste?: string;
}

export interface UserProfile {
  adresse?: string;
  rib?: string;
  telephone?: string;
  image?: string;
  numeroCnss?: string
  dateNaissance?: string
  lieuNaissance?: string
  nomBanque?: string
  statutSocial?: string
  nationalite?: string
  genre?: string
  photoPoste?: string;
  documents?: UserDocument[];
}

export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: UserRole;
  statutCompte: StatutCompte;
  profilCompletion: number;
  profile?: UserProfile;
  dateCreation: string;
  dateValidation?: string;
  dateLimit?: string;
  professionalInfo?: ProfessionalInfo;
}
export interface ProfessionalInfo {
  emailProfessionnel?: string
  telephoneProfessionnel?: string
  dateEmbauche?: string
}
export interface Affectation {
  id: string;
  userId: string;
  positionId: string;
  managerId?: string;
  dateAffectation: string;
}
export interface UserDocument {
  id: string;
  nom: string;
  type: string;
  contenu?: string;
  mimeType: string;
  dateUpload: string;
}
export interface CompanyDocument {
  id: string;
  nom: string;
  type: string;
  description?: string;
  contenu?: string;
  mimeType: string;
  taille: number;
  uploadedBy: string;
  dateUpload: string;
  actif: boolean;
}
export interface Position {
  id: string;
  titre: string;
  description?: string;
  actif: boolean;
}