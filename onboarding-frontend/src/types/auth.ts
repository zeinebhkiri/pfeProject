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
  dateEmbauche: string;
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
  datePriseDePoste?: string;          
  datePriseDePostePersonnalisee?: boolean;
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
// ── Parcours ──────────────────────────────────────────────────────────

export type TaskType =
  | "FORMATION"
  | "QUIZ"
  | "DOCUMENT_RH"
  | "DOCUMENT_SALARIE"
  | "ENTRETIEN"
  | "SIMPLE";

export type TypeActeur = "SALARIE" | "MANAGER" | "RH";

export type StatutTask =
  | "NON_COMMENCE"
  | "EN_COURS"
  | "TERMINE"
  | "REJETE";

export type StatutParcours = "EN_COURS" | "TERMINE" | "EXPIRE";

export interface Question {
  id: string;
  texte: string;
  options: string[];
  bonneReponse: number;
  points: number;
}

export interface TaskConfig {
  // FORMATION
  videoUrl?: string;
  fichierContenu?: string;
  fichierNom?: string;
  fichierMimeType?: string;
  // QUIZ
  questions?: Question[];
  scoreMinimum?: number;
  // DOCUMENT_RH
  documentContenu?: string;
  documentNom?: string;
  documentMimeType?: string;
  // DOCUMENT_SALARIE
  typeDocumentAttendu?: string;
  // ENTRETIEN
  dureeMinutes?: number;
  lieu?: string;
  notesEntretien?: string;
  // SIMPLE
  datePlanifiee?: string;
}

export interface TaskTemplate {
  id: string;
  parcoursTemplateId: string;
  titre: string;
  description?: string;
  taskType: TaskType;
  typeActeurs: TypeActeur[];
  ordre: number;
  obligatoire: boolean;
  delaiJours: number;
  config?: TaskConfig;
  phase?: string;
}

export interface ParcoursTemplate {
  id: string;
  titre: string;
  description?: string;
  positionId: string;
  actif: boolean;
}

export interface TaskCommentaire {
  auteurId: string;
  auteurNom: string;
  texte: string;
  date: string;
}

export interface ActeurProgression{
        typeActeur: TypeActeur;
        acteurId: string;
        complete: boolean;
        dateCompletion: string;
}

export interface Task {
  id: string;
  parcoursId: string;
  taskTemplateId: string;
  titre: string;
  description?: string;
  taskType: TaskType;
  typeActeurs: TypeActeur[];
  acteurIds?: string[];
  dateOuverture?: string;
  acteurProgressions?: ActeurProgression[];
  ordre: number;
  obligatoire: boolean;
  verrouille: boolean;
  statut: StatutTask;
  phase?: string;
  echeance?: string;
  dateCompletion?: string;
  scoreObtenu?: number;
  nbTentatives: number;
  progression: number;
  reponsesQuiz?: number[];
  documentContenu?: string;
  documentNom?: string;
  documentMimeType?: string;
  commentaires: TaskCommentaire[];
  config?: TaskConfig;
  dateEntretien?: string;
  documentEntretienContenu?: string;
  documentEntretienNom?: string;
  documentEntretienMimeType?: string;
}

export interface Parcours {
  id: string;
  userId: string;
  positionId: string;
  parcoursTemplateId: string;
  statut: StatutParcours;
  dateDebut: string;
  dateFin?: string;
  progression: number;
}

export interface ParcoursAvecTasks {
  parcours: Parcours;
  tasks: Task[];
}