export interface User {
  username: string;
  email: string;
  password: string;
  telefone: string;
  role?: string; // opcional, pode ser adicionado ao formulário depois se quiser
}