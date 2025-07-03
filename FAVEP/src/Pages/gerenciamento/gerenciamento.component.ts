import { Component, HostListener, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  ApiService,
  Usuario,
  Propriedade,
  Producao,
  Atividade as BackendAtividade,
  Movimentacao as BackendMovimentacao,
} from '../../services/api.service';

import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
registerLocaleData(localePt);


interface AtividadeComponent extends Omit<BackendAtividade, 'data'> {
  data: Date;
}

interface MovimentacaoComponent extends Omit<BackendMovimentacao, 'data'> {
  data: Date;
}

@Component({
  selector: 'app-gerenciamento',
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    FormsModule,
  ],
  providers: [DatePipe],
  templateUrl: './gerenciamento.component.html',
  styleUrl: './gerenciamento.component.css',
})
export class GerenciamentoComponent implements OnInit {
  menuAberto = false;

  @HostListener('document:click', ['$event'])
  fecharMenuFora(event: MouseEvent) {
    const alvo = event.target as HTMLElement;
    const clicouNoBotao = alvo.closest('.menu-toggle');
    const clicouNoMenu = alvo.closest('.main-menu');

    if (!clicouNoBotao && !clicouNoMenu) {
      this.menuAberto = false;
    }
  }

  usuarioNome: string = '';
  usuarioFoto: string = 'https://placehold.co/40x40/aabbcc/ffffff?text=User';

  abaAtiva: string = 'propriedades';
  modalAberto: boolean = false;
  confirmacaoAberta: boolean = false;
  configAberto: boolean = false;
  modalTitulo: string = '';
  mensagemConfirmacao: string = '';
  tipoEdicao: string = '';
  itemParaExcluir: any = null;
  tipoExclusao: string = '';

  filtroAtivo: string = 'todos';
  filtroPeriodo: string = '30';
  termoBusca: string = '';

  opcoesFiltro: { valor: string; texto: string }[] = [{ valor: 'todos', texto: 'Todos' }];

  
  novaSenha: string = '';

  propriedades: Propriedade[] = [];
  producoes: Producao[] = [];
  atividades: AtividadeComponent[] = [];
  movimentacoes: MovimentacaoComponent[] = [];

  propriedadesFiltradas: Propriedade[] = [];
  producoesFiltradas: Producao[] = [];
  movimentacoesFiltradas: MovimentacaoComponent[] = [];

  propriedadeEditada: Partial<Propriedade> = {};
  producaoEditada: Partial<Producao> = {};
  movimentacaoEditada: Partial<MovimentacaoComponent> = { tipo: 'receita' }; // 'tipo' é 'receita' ou 'despesa'

  todasCulturas: string[] = [];
  safras: string[] = [];

  constructor(private apiService: ApiService, private datePipe: DatePipe) {}

  ngOnInit(): void {
    
    const usuarioLogado = this.apiService.getUser();
    if (usuarioLogado && usuarioLogado.nome) {
      this.usuarioNome = usuarioLogado.nome;
      this.usuarioFoto = usuarioLogado.fotoPerfil || 'https://placehold.co/40x40/aabbcc/ffffff?text=User';
    }
    this.carregarTodosDados();
  }
  carregarTodosDados(): void {
    this.apiService.carregarDadosDashboard().subscribe({
      next: (data) => {
        const { perfil, propriedades, producoes, atividades, movimentacoes } = data;
        if (perfil) {
          this.usuarioNome = perfil.nome; 
          this.usuarioFoto = perfil.fotoPerfil || 'https://placehold.co/40x40/aabbcc/ffffff?text=User'; 
        }

        this.propriedades = data.propriedades;
        this.producoes = data.producoes;
        this.atividades = data.atividades
          .map((act) => ({
            ...act,
            data: new Date(act.data),
            icone: this.getIconForActivityType(act.tipo),
          }))
          .sort((a, b) => b.data.getTime() - a.data.getTime());

        this.movimentacoes = data.movimentacoes
          .map((rec) => ({
            ...rec,
            data: new Date(rec.data),
          }))
          .sort((a, b) => b.data.getTime() - a.data.getTime());

        const uniqueCrops = new Set<string>();
        this.producoes.forEach((prod) => uniqueCrops.add(prod.cultura));
        this.opcoesFiltro = [{ valor: 'todos', texto: 'Todos' }];
        Array.from(uniqueCrops)
          .sort()
          .forEach((cultura) => {
            this.opcoesFiltro.push({ valor: cultura, texto: cultura });
          });
        this.todasCulturas = Array.from(uniqueCrops).sort();

        const uniqueSafras = new Set<string>();
        this.producoes.forEach((prod) => {
          if (prod.safra) {
            uniqueSafras.add(prod.safra);
          }
        });
        this.safras = Array.from(uniqueSafras).sort();

        this.aplicarFiltros();
      },
      error: (err) => {
        console.error('Erro ao carregar dados:', err);
      },
    });
  }

  selecionarAba(aba: string): void {
    this.abaAtiva = aba;
    this.aplicarFiltros();
  }

  abrirModalAdicionar(): void {
    this.modalAberto = true;
    this.tipoEdicao = this.abaAtiva;
    this.modalTitulo = `Adicionar ${this.getTituloModal()}`;

    switch (this.tipoEdicao) {
      case 'propriedades':
        this.propriedadeEditada = { nome: '', localizacao: '', area: 0 };
        break;
      case 'producao':
        this.producaoEditada = {
          propriedadeId: 0,
          cultura: '',
          safra: '',
          quantidade: 0,
          area: 0,
          data: new Date(),
        }; // Ajuste conforme a interface Producao
        break;
      case 'financeiro':
        this.movimentacaoEditada = {
          tipo: 'receita',
          valor: 0,
          data: new Date(),
          descricao: '',
          propriedade: '',
          categoria: '',
        };
        break;
      
    }
  }

  getTituloModal(): string {
    switch (this.tipoEdicao) {
      case 'propriedades':
        return 'Propriedade';
      case 'producao':
        return 'Produção';
      case 'financeiro':
        return 'Movimentação Financeira';
      case 'atividades':
        return 'Atividade';
      default:
        return 'Item';
    }
  }

  fecharModal(): void {
    this.modalAberto = false;
    this.propriedadeEditada = {};
    this.producaoEditada = {};
    this.movimentacaoEditada = { tipo: 'receita' };
    this.atividadeEditada = {};
  }

  abrirConfiguracoes(): void {
    this.configAberto = true;
  }

  fecharConfig(): void {
    this.configAberto = false;
    this.novaSenha = '';
  }

  aplicarFiltros(): void {
    switch (this.abaAtiva) {
      case 'propriedades':
        this.filtrarPropriedades();
        break;
      case 'producao':
        this.filtrarProducoes();
        break;
      case 'financeiro':
        this.filtrarMovimentacoes();
        break;
    }
  }

  filtrarPropriedades(): void {
    this.propriedadesFiltradas = this.propriedades.filter((prop) => {
      const busca =
        !this.termoBusca ||
        prop.nome.toLowerCase().includes(this.termoBusca.toLowerCase()) ||
        prop.localizacao.toLowerCase().includes(this.termoBusca.toLowerCase());
      return busca;
    });
  }

  filtrarProducoes(): void {
    this.producoesFiltradas = this.producoes.filter((prod) => {
      const filtroCultura =
        this.filtroAtivo === 'todos' || prod.cultura === this.filtroAtivo;
      const busca =
        !this.termoBusca ||
        this.getNomePropriedade(prod.propriedadeId)
          .toLowerCase()
          .includes(this.termoBusca.toLowerCase()) ||
        prod.cultura.toLowerCase().includes(this.termoBusca.toLowerCase()) ||
        prod.safra.toLowerCase().includes(this.termoBusca.toLowerCase());
      return filtroCultura && busca;
    });
  }

 

  filtrarMovimentacoes(): void {
    const dias = parseInt(this.filtroPeriodo);
    const dataLimite = new Date();
    if (!isNaN(dias)) {
      dataLimite.setDate(dataLimite.getDate() - dias);
    }

    this.movimentacoesFiltradas = this.movimentacoes.filter((mov) => {
      const periodo = this.filtroPeriodo === 'todos' || mov.data >= dataLimite;
      const busca =
        !this.termoBusca ||
        (mov.descricao &&
          mov.descricao.toLowerCase().includes(this.termoBusca.toLowerCase())) ||
        (mov.propriedade &&
          this.getNomePropriedade(mov.propriedade)
            .toLowerCase()
            .includes(this.termoBusca.toLowerCase()));
      return periodo && busca;
    });
  }

  getNomePropriedade(id: string | number): string {
    // Sua API de propriedades tem 'id: string', mas a Producao tem 'propriedadeId: number'.
    // Precisamos ajustar isso. Assumindo que Producao.propriedadeId deveria ser string para bater com Propriedade.id
    // Se no backend o ID da propriedade na Produção é um number, você precisará ajustar o lookup.
    const prop = this.propriedades.find((p) => p.id === String(id));
    return prop ? prop.nome : 'Desconhecida';
  }

  getIconForActivityType(type: string): string {
    switch (type.toLowerCase()) {
      case 'plantio':
        return 'fa-seedling';
      case 'colheita':
        return 'fa-wheat-awn';
      case 'manutencao':
        return 'fa-tractor';
      case 'pagamento':
      case 'receita':
        return 'fa-dollar-sign';
      case 'despesa':
        return 'fa-money-bill-wave';
      case 'previsao':
        return 'fa-cloud-rain';
      default:
        return 'fa-clipboard-list';
    }
  }

  calcularAreaTotal(): number {
    return this.propriedades.reduce((total, prop) => total + prop.area, 0);
  }

  contarCulturasAtivas(): number {
    const culturasUnicas = new Set<string>();
    this.producoes.forEach((prod) => culturasUnicas.add(prod.cultura));
    return culturasUnicas.size;
  }

  calcularProducaoTotal(): number {
    return this.producoes.reduce((total, prod) => total + prod.quantidade, 0);
  }

  calcularAreaPlantada(): number {
    const areasComCulturas = new Set<string>();
    this.producoes.forEach((prod) => {
      // Aqui, `prod.propriedadeId` é `number`, enquanto `propriedade.id` é `string`.
      // Vamos converter para string para a comparação.
      if (prod.propriedadeId) {
        areasComCulturas.add(String(prod.propriedadeId));
      }
    });

    let totalArea = 0;
    areasComCulturas.forEach((propertyId) => {
      const prop = this.propriedades.find((p) => p.id === propertyId);
      if (prop) {
        totalArea += prop.area;
      }
    });
    return totalArea;
  }

  calcularProdutividadeMedia(): number {
    const totalProducao = this.calcularProducaoTotal();
    const totalArea = this.calcularAreaPlantada();
    return totalArea > 0 ? totalProducao / totalArea : 0;
  }

  calcularTotalReceitas(): number {
    return this.movimentacoes
      .filter((m) => m.tipo === 'receita')
      .reduce((total, m) => total + m.valor, 0);
  }

  calcularTotalDespesas(): number {
    return this.movimentacoes
      .filter((m) => m.tipo === 'despesa')
      .reduce((total, m) => total + m.valor, 0);
  }

  calcularResultadoFinanceiro(): number {
    return this.calcularTotalReceitas() - this.calcularTotalDespesas();
  }

  editarPropriedade(prop: Propriedade): void {
    this.propriedadeEditada = { ...prop };
    this.modalTitulo = 'Editar Propriedade';
    this.tipoEdicao = 'propriedades';
    this.modalAberto = true;
  }

  editarProducao(prod: Producao): void {
    this.producaoEditada = { ...prod };
    this.producaoEditada.data = this.datePipe.transform(prod.data, 'yyyy-MM-dd') as any; // Ajuste para 'data'
    this.modalTitulo = 'Editar Produção';
    this.tipoEdicao = 'producao';
    this.modalAberto = true;
  }

  

  editarMovimentacao(mov: MovimentacaoComponent): void {
    this.movimentacaoEditada = { ...mov };
    this.movimentacaoEditada.data = this.datePipe.transform(mov.data, 'yyyy-MM-dd') as any;
    this.modalTitulo = 'Editar Movimentação Financeira';
    this.tipoEdicao = 'financeiro';
    this.modalAberto = true;
  }

  confirmarExclusao(item: any, tipo: string): void {
    this.itemParaExcluir = item;
    this.tipoExclusao = tipo;
    this.mensagemConfirmacao = `Confirmar exclusão de "${tipo === 'propriedades' ? item.nome : item.descricao || item.cultura}"?`; // Ajustado para 'nome' e 'cultura'
    this.confirmacaoAberta = true;
  }

  cancelarExclusao(): void {
    this.confirmacaoAberta = false;
    this.itemParaExcluir = null;
    this.tipoExclusao = '';
  }

  executarExclusao(): void {
    if (!this.itemParaExcluir || !this.itemParaExcluir.id) {
      console.error('Item para exclusão inválido ou sem ID.');
      this.cancelarExclusao();
      return;
    }

    switch (this.tipoExclusao) {
      case 'propriedades':
        this.apiService.excluirPropriedade(this.itemParaExcluir.id).subscribe({
          next: () => {
            this.propriedades = this.propriedades.filter(
              (p) => p.id !== this.itemParaExcluir.id
            );
            this.aplicarFiltros();
            this.confirmacaoAberta = false;
          },
          error: (err) => console.error('Erro ao excluir propriedade:', err),
        });
        break;
      case 'producao':
        this.apiService.excluirProducao(this.itemParaExcluir.id).subscribe({
          next: () => {
            this.producoes = this.producoes.filter((c) => c.id !== this.itemParaExcluir.id);
            this.aplicarFiltros();
            this.confirmacaoAberta = false;
          },
          error: (err) => console.error('Erro ao excluir produção:', err),
        });
        break;
      case 'atividades':
        this.apiService.excluirAtividade(this.itemParaExcluir.id).subscribe({
          next: () => {
            this.atividades = this.atividades.filter(
              (a) => a.id !== this.itemParaExcluir.id
            );
            this.aplicarFiltros();
            this.confirmacaoAberta = false;
          },
          error: (err) => console.error('Erro ao excluir atividade:', err),
        });
        break;
      case 'financeiro':
        this.apiService.excluirMovimentacao(this.itemParaExcluir.id).subscribe({
          next: () => {
            this.movimentacoes = this.movimentacoes.filter(
              (m) => m.id !== this.itemParaExcluir.id
            );
            this.aplicarFiltros();
            this.confirmacaoAberta = false;
          },
          error: (err) => console.error('Erro ao excluir movimentação:', err),
        });
        break;
      default:
        console.warn('Tipo de exclusão desconhecido:', this.tipoExclusao);
        this.cancelarExclusao();
    }
    this.itemParaExcluir = null;
    this.tipoExclusao = '';
  }

  salvar(): void {
    switch (this.tipoEdicao) {
      case 'propriedades':
        this.salvarPropriedade();
        break;
      case 'producao':
        this.salvarProducao();
        break;
      case 'atividades':
        this.salvarAtividade();
        break;
      case 'financeiro':
        this.salvarMovimentacao();
        break;
    }
  }

  salvarPropriedade(): void {
    if (
      !this.propriedadeEditada.nome ||
      !this.propriedadeEditada.localizacao ||
      this.propriedadeEditada.area === undefined ||
      this.propriedadeEditada.area <= 0
    ) {
      console.error('Dados da propriedade incompletos ou inválidos.');
      return;
    }

    // Certifique-se de que 'id' é usado para verificar se é uma edição
    if (this.propriedadeEditada.id) {
      this.apiService
        .atualizarPropriedade(this.propriedadeEditada.id, this.propriedadeEditada)
        .subscribe({
          next: (updatedProp) => {
            const index = this.propriedades.findIndex((p) => p.id === updatedProp.id);
            if (index !== -1) {
              this.propriedades[index] = updatedProp;
            }
            this.fecharModal();
            this.aplicarFiltros();
          },
          error: (err) => console.error('Erro ao atualizar propriedade:', err),
        });
    } else {
      // Ajuste o tipo para a chamada `adicionarPropriedade`
      const novaProp: Omit<Propriedade, 'id' | 'proprietario'> = {
        nome: this.propriedadeEditada.nome,
        localizacao: this.propriedadeEditada.localizacao,
        area: this.propriedadeEditada.area,
      };
      this.apiService.adicionarPropriedade(novaProp).subscribe({
        next: (newProp) => {
          this.propriedades.push(newProp);
          this.fecharModal();
          this.aplicarFiltros();
        },
        error: (err) => console.error('Erro ao adicionar propriedade:', err),
      });
    }
  }

  salvarProducao(): void {
    // Sua interface Producao na API tem id: number, propriedadeId: number, data: Date
    // Seu componente está usando string para data e não tem id como number na edição inicial
    if (
      !this.producaoEditada.cultura ||
      !this.producaoEditada.safra ||
      this.producaoEditada.quantidade === undefined ||
      this.producaoEditada.area === undefined ||
      !this.producaoEditada.data ||
      !this.producaoEditada.propriedadeId
    ) {
      console.error('Dados da produção incompletos.');
      return;
    }

    // Converte a string de data para Date, se necessário, ou formata como string ISO
    const dataFormatada =
      typeof this.producaoEditada.data === 'string'
        ? new Date(this.producaoEditada.data)
        : this.producaoEditada.data;

    const producaoToSave: Omit<Producao, 'id'> | Producao = {
      ...this.producaoEditada,
      propriedadeId: Number(this.producaoEditada.propriedadeId), // Garante que é um number
      quantidade: Number(this.producaoEditada.quantidade),
      area: Number(this.producaoEditada.area),
      data: dataFormatada,
    } as Omit<Producao, 'id'>; // Assumimos que o 'id' não está presente ao adicionar

    if (this.producaoEditada.id) {
      // Se estamos editando, o 'id' deve existir e ser um number
      this.apiService
        .atualizarProducao(String(this.producaoEditada.id), producaoToSave as Producao) // O método espera string para id
        .subscribe({
          next: (updatedProd) => {
            const index = this.producoes.findIndex((p) => p.id === updatedProd.id);
            if (index !== -1) {
              this.producoes[index] = updatedProd;
            }
            this.fecharModal();
            this.aplicarFiltros();
          },
          error: (err) => console.error('Erro ao atualizar produção:', err),
        });
    } else {
      this.apiService.adicionarProducao(producaoToSave).subscribe({
        next: (newProd) => {
          this.producoes.push(newProd);
          this.fecharModal();
          this.aplicarFiltros();
        },
        error: (err) => console.error('Erro ao adicionar produção:', err),
      });
    }
  }

  // Novo método para salvar atividades
  atividadeEditada: Partial<BackendAtividade> = {};
  salvarAtividade(): void {
    if (
      !this.atividadeEditada.descricao ||
      !this.atividadeEditada.data ||
      !this.atividadeEditada.tipo
    ) {
      console.error('Dados da atividade incompletos.');
      return;
    }

    // Formata a data para o formato esperado pelo backend (string ISO)
    const dataAtividade = this.datePipe.transform(
      this.atividadeEditada.data,
      'yyyy-MM-ddTHH:mm:ss.SSSZ'
    );
    if (!dataAtividade) {
      console.error('Formato de data inválido para atividade.');
      return;
    }

    const atividadeToSave: Omit<BackendAtividade, 'id' | 'responsavel' | 'icone'> = {
      ...this.atividadeEditada,
      data: dataAtividade,
      // 'responsavel' e 'icone' serão tratados pelo backend ou preenchidos automaticamente.
    } as Omit<BackendAtividade, 'id' | 'responsavel' | 'icone'>;

    if (this.atividadeEditada.id) {
      this.apiService
        .atualizarAtividade(this.atividadeEditada.id, atividadeToSave)
        .subscribe({
          next: (updatedAtv) => {
            const index = this.atividades.findIndex((a) => a.id === updatedAtv.id);
            if (index !== -1) {
              this.atividades[index] = {
                ...updatedAtv,
                data: new Date(updatedAtv.data),
                icone: this.getIconForActivityType(updatedAtv.tipo),
              };
            }
            this.fecharModal();
            this.aplicarFiltros();
          },
          error: (err) => console.error('Erro ao atualizar atividade:', err),
        });
    } else {
      this.apiService.adicionarAtividade(atividadeToSave).subscribe({
        next: (newAtv) => {
          this.atividades.push({
            ...newAtv,
            data: new Date(newAtv.data),
            icone: this.getIconForActivityType(newAtv.tipo),
          });
          this.fecharModal();
          this.aplicarFiltros();
        },
        error: (err) => console.error('Erro ao adicionar atividade:', err),
      });
    }
  }

  salvarMovimentacao(): void {
    if (
      !this.movimentacaoEditada.tipo ||
      !this.movimentacaoEditada.descricao ||
      this.movimentacaoEditada.valor === undefined ||
      !this.movimentacaoEditada.data
    ) {
      console.error('Dados da movimentação incompletos.');
      return;
    }
    if (this.movimentacaoEditada.valor <= 0) {
      console.error('O valor da movimentação deve ser maior que zero.');
      return;
    }

    // Formata a data para o formato esperado pelo backend (string ISO)
    const dataMovimentacao = this.datePipe.transform(
      this.movimentacaoEditada.data,
      'yyyy-MM-ddTHH:mm:ss.SSSZ'
    );
    if (!dataMovimentacao) {
      console.error('Formato de data inválido para movimentação.');
      return;
    }

    const movimentacaoToSave: Omit<BackendMovimentacao, 'id'> = {
      ...this.movimentacaoEditada,
      valor: Number(this.movimentacaoEditada.valor),
      data: new Date(dataMovimentacao), // Convertendo de volta para Date para a API
    } as Omit<BackendMovimentacao, 'id'>;

    if (this.movimentacaoEditada.id) {
      // id é number na sua interface da API, mas os métodos aceitam string para id
      this.apiService
        .atualizarMovimentacao(
          String(this.movimentacaoEditada.id),
          movimentacaoToSave as BackendMovimentacao
        )
        .subscribe({
          next: (updatedRecord) => {
            const index = this.movimentacoes.findIndex(
              (r) => r.id === updatedRecord.id
            );
            if (index !== -1) {
              this.movimentacoes[index] = {
                ...updatedRecord,
                data: new Date(updatedRecord.data),
              };
            }
            this.fecharModal();
            this.aplicarFiltros();
          },
          error: (err) => console.error('Erro ao atualizar movimentação:', err),
        });
    } else {
      this.apiService.adicionarMovimentacao(movimentacaoToSave).subscribe({
        next: (newRecord) => {
          this.movimentacoes.push({ ...newRecord, data: new Date(newRecord.data) });
          this.fecharModal();
          this.aplicarFiltros();
        },
        error: (err) => console.error('Erro ao adicionar movimentação:', err),
      });
    }
  }

  trackById(index: number, item: any): string {
    return item.id; // Alterado de _id para id
  }
}