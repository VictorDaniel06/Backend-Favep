// FAVEP/src/Models/movimentacao.model.ts
export interface Movimentacao {
    id: number; // INTEGER AUTOINCREMENT no backend
    tipo: 'receita' | 'despesa';
    descricao: string;
    valor: number;
    data: Date | string; // Pode vir como string do backend, converter para Date no frontend
    propriedade?: string; // Nome da propriedade, pode ser opcional no backend
    usuarioId?: string; // ID do usuário que criou a movimentação
  }