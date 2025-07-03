export interface Propriedade {
  id: string;
  nomepropriedade: string;
  area_ha: number;
  localizacao: string;
  usuarioId: string;
  culturas: string[];
  produtividade?: number; // Adicionado para a lógica da tela
  ativo?: boolean; // Adicionado para a lógica da tela
  usuario?: any; // O objeto do usuário também é retornado
}
