// src/api/AuthApi.ts
import axios from "axios";
import {
  type LoginRequest,
  type LoginResponse,
  type ActivateAccountRequest,
  type TokenInfo,
  type CreateEmployeeRequest,
  type ProfileUpdateRequest,
  type User,
  type UserDocument,
  type CompanyDocument,
  type Position,
    type ParcoursTemplate,
  type TaskTemplate,
  type Parcours,
  type Task,
  type ParcoursAvecTasks,
} from "../types/auth";
import { type Affectation } from "../types/auth";


const API_BASE = "http://localhost:8080/api";

// ─── Instance pour toutes les requêtes sécurisées (JWT) ───────────────
const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Ajouter automatiquement le JWT pour toutes les requêtes sécurisées
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwt_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Instance pour login / activation / token-info (pas de JWT) ──────
const apiNoAuth = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// ── Auth ──────────────────────────────────────────────────────────────

// Login (pas de token envoyé)
export const loginApi = async (data: LoginRequest): Promise<LoginResponse> => {
  const res = await apiNoAuth.post<LoginResponse>("/auth/login", data);
  // Stocker le token pour les prochaines requêtes
  localStorage.setItem("jwt_token", res.data.token);
  return res.data;
};

// Activer un compte (pas de token nécessaire)
export const activateAccountApi = async (data: ActivateAccountRequest): Promise<string> => {
  const res = await apiNoAuth.post<string>("/auth/activate", data);
  return res.data;
};

// Obtenir les infos d’un token (pas de token nécessaire)
export const getTokenInfoApi = async (token: string): Promise<TokenInfo> => {
  const res = await apiNoAuth.get<TokenInfo>(`/auth/token-info?token=${token}`);
  return res.data;
};

// Créer un employé (ADMIN uniquement, JWT requis)
export const createEmployeeApi = async (data: CreateEmployeeRequest): Promise<string> => {
  const res = await api.post<string>("/auth/create-employee", data);
  return res.data;
};

// ── Users ─────────────────────────────────────────────────────────────
export const getCurrentUserApi = async (): Promise<User> => {
  const res = await api.get<User>("/users/me");
  return res.data;
};

export const updateMyProfileApi = async (data: ProfileUpdateRequest): Promise<User> => {
  const res = await api.put<User>("/users/me/profile", data);
  return res.data;
};

export const getAllUsersApi = async (): Promise<User[]> => {
  const res = await api.get<User[]>("/users");
  return res.data;
};

export const getUserByIdApi = async (id: string): Promise<User> => {
  const res = await api.get<User>(`/users/${id}`);
  return res.data;
};

export const validateUserApi = async (id: string): Promise<void> => {
  await api.put(`/users/${id}/validate`);
};

export const disableUserApi = async (id: string): Promise<void> => {
  await api.put(`/users/${id}/disable`);
};

// ── Affectations ──────────────────────────────────────────────────────
export const createAffectationApi = async (data: {
  userId: string;
  positionId: string;  // ← remplace poste
  managerId?: string;
}): Promise<Affectation> => {
  const res = await api.post<Affectation>("/affectations", data);
  return res.data;
};
export const getAffectationByUserApi = async (userId: string): Promise<Affectation> => {
  const res = await api.get<Affectation>(`/affectations/user/${userId}`);
  return res.data;
};

export const getAllManagersApi = async (): Promise<User[]> => {
  const res = await api.get<User[]>("/users/managers");
  return res.data;
};
// Upload image de profil
export const uploadProfileImageApi = async (formData: FormData): Promise<{ imageUrl: string }> => {
  const response = await api.post('/users/profile/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};
// Supprimer l'image de profil
export const removeProfileImageApi = async (): Promise<void> => {
  await api.delete('/users/profile/image');
};
export const sendCorrectionEmailApi = async (
  id: string,
  data: { commentaire: string; dateLimite: string }
): Promise<void> => {
  await api.post(`/users/${id}/send-correction-email`, data);
};
export const getMyTeamApi = async (): Promise<User[]> => {
  const res = await api.get<User[]>("/users/my-team");
  return res.data;
};
// Upload document
export const uploadDocumentApi = async (data: {
  nom: string;
  type: string;
  contenu: string;
  mimeType: string;
}): Promise<UserDocument> => {
  const res = await api.post<UserDocument>("/users/me/documents", data);
  return res.data;
};

// Supprimer document
export const deleteDocumentApi = async (docId: string): Promise<void> => {
  await api.delete(`/users/me/documents/${docId}`);
};

// Récupérer document (admin)
export const getDocumentApi = async (
  userId: string,
  docId: string
): Promise<UserDocument> => {
  const res = await api.get<UserDocument>(`/users/${userId}/documents/${docId}`);
  return res.data;
};
// Liste documents entreprise
export const getCompanyDocumentsApi = async (): Promise<CompanyDocument[]> => {
  const res = await api.get<CompanyDocument[]>("/company-documents");
  return res.data;
};

// Récupérer un document avec contenu
export const getCompanyDocumentApi = async (id: string): Promise<CompanyDocument> => {
  const res = await api.get<CompanyDocument>(`/company-documents/${id}`);
  return res.data;
};

// Upload document entreprise (admin)
export const uploadCompanyDocumentApi = async (data: {
  nom: string;
  type: string;
  description: string;
  contenu: string;
  mimeType: string;
  taille: number;
}): Promise<CompanyDocument> => {
  const res = await api.post<CompanyDocument>("/company-documents", data);
  return res.data;
};

// Supprimer document entreprise (admin)
export const deleteCompanyDocumentApi = async (id: string): Promise<void> => {
  await api.delete(`/company-documents/${id}`);
};
// Demander réinitialisation
export const forgotPasswordApi = async (email: string): Promise<{ message: string }> => {
  const res = await api.post<{ message: string }>("/auth/forgot-password", { email });
  return res.data;
};

// Réinitialiser mot de passe
export const resetPasswordApi = async (data: {
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<{ message: string }> => {
  const res = await api.post<{ message: string }>("/auth/reset-password", data);
  return res.data;
};
// Dans authApi.ts - corrigez la fonction updateProfessionalInfoApi
export const updateProfessionalInfoApi = async (userId: string, data: any) => {
  try {
    // Enlever le /api en double - l'URL de base est déjà définie dans l'instance axios
    const response = await api.put(`/users/${userId}/professional-info`, data);
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la mise à jour des infos professionnelles:", error);
    throw error;
  }
};
// Récupérer tous les postes
export const getPositionsApi = async (): Promise<Position[]> => {
  const res = await api.get<Position[]>("/positions");
  return res.data;
};
export const createPositionApi = async (data: { titre: string; description: string }): Promise<Position> => {
  const res = await api.post<Position>("/positions", data);
  return res.data;
};

export const updatePositionApi = async (id: string, data: { titre: string; description: string }): Promise<Position> => {
  const res = await api.put<Position>(`/positions/${id}`, data);
  return res.data;
};

export const deletePositionApi = async (id: string): Promise<void> => {
  await api.delete(`/positions/${id}`);
};
export const getParcoursTemplatesApi = async (): Promise<ParcoursTemplate[]> => {
  const res = await api.get<ParcoursTemplate[]>("/parcours-templates");
  return res.data;
};

export const getParcoursTemplateByPositionApi = async (
  positionId: string
): Promise<ParcoursTemplate> => {
  const res = await api.get<ParcoursTemplate>(
    `/parcours-templates/position/${positionId}`
  );
  return res.data;
};

export const createParcoursTemplateApi = async (data: {
  titre: string;
  description: string;
  positionId: string;
}): Promise<ParcoursTemplate> => {
  const res = await api.post<ParcoursTemplate>("/parcours-templates", data);
  return res.data;
};

export const updateParcoursTemplateApi = async (
  id: string,
  data: { titre: string; description: string }
): Promise<ParcoursTemplate> => {
  const res = await api.put<ParcoursTemplate>(`/parcours-templates/${id}`, data);
  return res.data;
};

export const deleteParcoursTemplateApi = async (id: string): Promise<void> => {
  await api.delete(`/parcours-templates/${id}`);
};

// ── Task Templates ────────────────────────────────────────────────────

export const getTaskTemplatesApi = async (
  parcoursTemplateId: string
): Promise<TaskTemplate[]> => {
  const res = await api.get<TaskTemplate[]>(
    `/parcours-templates/${parcoursTemplateId}/tasks`
  );
  return res.data;
};

export const createTaskTemplateApi = async (
  parcoursTemplateId: string,
  data: Partial<TaskTemplate>
): Promise<TaskTemplate> => {
  const res = await api.post<TaskTemplate>(
    `/parcours-templates/${parcoursTemplateId}/tasks`,
    data
  );
  return res.data;
};

export const updateTaskTemplateApi = async (
  parcoursTemplateId: string,
  taskId: string,
  data: Partial<TaskTemplate>
): Promise<TaskTemplate> => {
  const res = await api.put<TaskTemplate>(
    `/parcours-templates/${parcoursTemplateId}/tasks/${taskId}`,
    data
  );
  return res.data;
};

export const deleteTaskTemplateApi = async (
  parcoursTemplateId: string,
  taskId: string
): Promise<void> => {
  await api.delete(`/parcours-templates/${parcoursTemplateId}/tasks/${taskId}`);
};

export const reorderTaskTemplatesApi = async (
  parcoursTemplateId: string,
  orders: { taskId: string; ordre: number }[]
): Promise<void> => {
  await api.put(
    `/parcours-templates/${parcoursTemplateId}/tasks/reorder`,
    orders
  );
};

// ── Parcours ──────────────────────────────────────────────────────────

export const getMyParcoursApi = async (): Promise<Parcours> => {
  const res = await api.get<Parcours>("/parcours/me");
  return res.data;
};

export const getMyTasksApi = async (): Promise<Task[]> => {
  const res = await api.get<Task[]>("/parcours/me/tasks");
  return res.data;
};

export const getParcoursOfUserApi = async (
  userId: string
): Promise<ParcoursAvecTasks> => {
  const res = await api.get<ParcoursAvecTasks>(`/parcours/user/${userId}`);
  return res.data;
};

export const getAllParcoursApi = async (): Promise<Parcours[]> => {
  const res = await api.get<Parcours[]>("/parcours");
  return res.data;
};

export const getTeamParcoursApi = async (): Promise<any[]> => {
  const res = await api.get<any[]>("/parcours/my-team");
  return res.data;
};

// ── Tasks ─────────────────────────────────────────────────────────────

export const startTaskApi = async (taskId: string): Promise<Task> => {
  const res = await api.put<Task>(`/tasks/${taskId}/start`);
  return res.data;
};

export const submitQuizApi = async (
  taskId: string,
  reponses: number[]
): Promise<Task> => {
  const res = await api.put<Task>(`/tasks/${taskId}/submit-quiz`, { reponses });
  return res.data;
};

export const submitDocumentTaskApi = async (
  taskId: string,
  data: { contenu: string; nom: string; mimeType: string }
): Promise<Task> => {
  const res = await api.put<Task>(`/tasks/${taskId}/submit-document`, data);
  return res.data;
};

export const validateTaskApi = async (
  taskId: string,
  data: {
    approuve: boolean;
    commentaire?: string;
    auteurId: string;
    auteurNom: string;
  }
): Promise<Task> => {
  const res = await api.put<Task>(`/tasks/${taskId}/validate`, data);
  return res.data;
};

export const completeTaskApi = async (taskId: string): Promise<Task> => {
  const res = await api.put<Task>(`/tasks/${taskId}/complete`);
  return res.data;
};

export const addCommentTaskApi = async (
  taskId: string,
  data: { auteurId: string; auteurNom: string; texte: string }
): Promise<Task> => {
  const res = await api.post<Task>(`/tasks/${taskId}/comments`, data);
  return res.data;
};

export const getAssignedTasksApi = async (): Promise<Task[]> => {
  const res = await api.get<Task[]>("/tasks/assigned");
  return res.data;
};
export const planifierEntretienApi = async (
  taskId: string,
  data: {
    dateEntretien: string;
    documentContenu?: string;
    documentNom?: string;
    documentMimeType?: string;
  }
): Promise<Task> => {
  const res = await api.put<Task>(`/tasks/${taskId}/planifier-entretien`, data);
  return res.data;
};