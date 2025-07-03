// FAVEP/src/Models/producao.model.ts
export interface Producao {
    id: number; // INTEGER AUTOINCREMENT no backend
    safra: string;
    areaproducao: number; // Nome do campo no backend para área da produção
    quantidade: number;
    data: Date | string; // Pode vir como string do backend, converter para Date no frontend
    cultura: string;
    nomepropriedade: string; // Nome da propriedade associada
    usuarioId?: string; // ID do usuário que criou a produção
  }