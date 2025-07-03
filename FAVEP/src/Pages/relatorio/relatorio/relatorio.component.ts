import { Component, HostListener, OnInit, ViewChild, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common'; // Incluir DatePipe
import { FormsModule } from '@angular/forms'; // Incluir FormsModule para ngModel
import { Chart, registerables } from 'chart.js'; // Para criar gráficos

// Importe o ApiService e as interfaces de dados do backend (nomes em português)
import { ApiService, Usuario, Propriedade, Producao, Movimentacao as BackendMovimentacao } from '../../../services/api.service';

// Registra a localidade para que os pipes de number, currency, date funcionem corretamente
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
registerLocaleData(localePt);

// Interface local para Movimentacao, onde 'data' é um objeto Date
interface MovimentacaoComponent extends Omit<BackendMovimentacao, 'data'> {
  data: Date;
}

@Component({
  selector: 'app-relatorio',
  standalone: true,
  imports: [
    RouterLink,
    CommonModule, // Para pipes e diretivas comuns
    FormsModule // Para [(ngModel)] em formulários
  ],
  providers: [DatePipe], // Forneça DatePipe para injeção
  templateUrl: './relatorio.component.html',
  styleUrl: './relatorio.component.css'
})
export class RelatorioComponent implements OnInit {
 
  menuAberto = false;
  usuarioNome: string = '';
  usuarioFoto: string = 'https://placehold.co/40x40/aabbcc/ffffff?text=User'; 

 
  propriedades: Propriedade[] = [];
  producoes: Producao[] = [];
  movimentacoes: MovimentacaoComponent[] = []; 

 
  selectedPropertyId: string = 'todos'; // ID da propriedade selecionada, 'todos' por padrão
  startDate: string = ''; // Data de início para o filtro de período (string para input type="date")
  endDate: string = '';   // Data de fim para o filtro de período (string para input type="date")
  selectedCropType: string = 'todos'; // Tipo de cultura selecionada para filtro (cultura na API)
  reportType: 'productivity' | 'financial' | 'crop_production' = 'productivity'; // Tipo de relatório

 
  availableCropTypes: { value: string, text: string }[] = [{ value: 'todos', text: 'Todas as Culturas' }];

  // Referência ao canvas do gráfico
  @ViewChild('reportChartCanvas', { static: true }) reportChartCanvas!: ElementRef<HTMLCanvasElement>;
  reportChart: Chart | null = null; // Instância do Chart.js

  constructor(private apiService: ApiService, private datePipe: DatePipe) {
    Chart.register(...registerables); // Registra componentes do Chart.js
  }

  ngOnInit(): void {
    
    const usuarioLogado = this.apiService.getUser();
    if (usuarioLogado && usuarioLogado.nome) {
      this.usuarioNome = usuarioLogado.nome;
      this.usuarioFoto = usuarioLogado.fotoPerfil || 'https://placehold.co/40x40/aabbcc/ffffff?text=User';
    }
    this.carregarDadosIniciais();
  }

  carregarDadosIniciais(): void {
    this.apiService.carregarDadosDashboard().subscribe({ 
      next: (data) => {
        const { perfil, propriedades, producoes, atividades, movimentacoes } = data;
        if (perfil) {
          this.usuarioNome = perfil.nome; 
          this.usuarioFoto = perfil.fotoPerfil || 'https://placehold.co/40x40/aabbcc/ffffff?text=User'; 
        }

        this.propriedades = data.propriedades; 
        this.producoes = data.producoes;  
        this.movimentacoes = data.movimentacoes.map(rec => ({ ...rec, data: new Date(rec.data) })); 

        // Preenche as opções de tipo de cultura para o filtro
        const uniqueCropTypes = new Set<string>();
        this.producoes.forEach(prod => uniqueCropTypes.add(prod.cultura)); // 'cultura' em vez de 'name'
        Array.from(uniqueCropTypes).sort().forEach(type => {
          this.availableCropTypes.push({ value: type, text: type });
        });

        
        this.gerarRelatorio();
      },
      error: (err) => {
        console.error('Erro ao carregar dados iniciais para o relatório:', err);
        
      }
    });
  }

 
  gerarRelatorio(): void {
  
    if (this.reportChart) {
      this.reportChart.destroy();
      this.reportChart = null;
    }

    const ctx = this.reportChartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      console.error('Contexto 2D do canvas não pôde ser obtido!');
      return;
    }

    let labels: string[] = [];
    let data: number[] = [];
    let chartTitle: string = '';
    let chartType: 'bar' | 'line' | 'pie' = 'bar'; // Tipo de gráfico padrão
    let datasets: any[] = []; // Para múltiplos datasets (ex: receitas e despesas)

    // Filtra os dados brutos com base nos filtros selecionados
    const filteredProperties = this.selectedPropertyId === 'todos'
      ? this.propriedades
      : this.propriedades.filter(p => p.id === this.selectedPropertyId); // 'id' em vez de '_id'

    const filteredProducoes = this.producoes.filter(prod => {
      // Note: Sua interface Producao tem propriedadeId: number, enquanto Propriedade tem id: string.
      // Se o ID da propriedade na Producao é um number no backend, você pode precisar ajustar a comparação.
      const isPropertyMatch = this.selectedPropertyId === 'todos' || String(prod.propriedadeId) === this.selectedPropertyId;
      const isCropTypeMatch = this.selectedCropType === 'todos' || prod.cultura === this.selectedCropType; // 'cultura' em vez de 'name'
      return isPropertyMatch && isCropTypeMatch;
    });

    const filteredMovimentacoes = this.movimentacoes.filter(mov => { 
      const recordDate = mov.data; 
      const isPropertyMatch = this.selectedPropertyId === 'todos' || mov.propriedade === this.selectedPropertyId; // 'propriedade' em vez de 'property'
      const isDateRangeMatch = (!this.startDate || recordDate >= new Date(this.startDate)) &&
                               (!this.endDate || recordDate <= new Date(this.endDate));
      return isPropertyMatch && isDateRangeMatch;
    });

    // Lógica para gerar dados do gráfico com base no tipo de relatório
    switch (this.reportType) {
      case 'productivity':
        chartTitle = 'Produtividade por Cultura (kg/ha)';
        chartType = 'bar';
        const productivityData: { [key: string]: { totalYield: number, totalArea: number } } = {};

        filteredProducoes.forEach(prod => { // 'filteredProducoes' em vez de 'filteredCrops'
          if (!productivityData[prod.cultura]) { // 'cultura' em vez de 'name'
            productivityData[prod.cultura] = { totalYield: 0, totalArea: 0 };
          }
          productivityData[prod.cultura].totalYield += (prod.quantidade || 0); // 'quantidade' em vez de 'actualYield'
          // Soma a área da propriedade associada à cultura para o cálculo da produtividade
          // Convertendo prod.propriedadeId para string para a comparação, se Propriedade.id for string.
          const propArea = this.propriedades.find(p => p.id === String(prod.propriedadeId))?.area || 0; // 'id' em vez de '_id', 'area' em vez de 'area'
          productivityData[prod.cultura].totalArea += propArea;
        });

        labels = Object.keys(productivityData).sort();
        data = labels.map(label => {
          const item = productivityData[label];
          return item.totalArea > 0 ? item.totalYield / item.totalArea : 0;
        });

        datasets = [{
          label: 'Produtividade (kg/ha)',
          data: data,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }];
        break;

      case 'financial':
        chartTitle = 'Resultado Financeiro (R$)';
        chartType = 'bar';
        const totalRevenue = filteredMovimentacoes.filter(r => r.tipo === 'receita').reduce((sum, r) => sum + r.valor, 0); // 'tipo' e 'valor'
        const totalExpense = filteredMovimentacoes.filter(r => r.tipo === 'despesa').reduce((sum, r) => sum + r.valor, 0); // 'tipo' e 'valor'
        const netResult = totalRevenue - totalExpense;

        labels = ['Receitas', 'Despesas', 'Resultado'];
        datasets = [{
          label: 'Valor (R$)',
          data: [totalRevenue, totalExpense, netResult],
          backgroundColor: [
            'rgba(40, 167, 69, 0.6)', // Receitas (Verde)
            'rgba(220, 53, 69, 0.6)', // Despesas (Vermelho)
            netResult >= 0 ? 'rgba(0, 123, 255, 0.6)' : 'rgba(255, 193, 7, 0.6)' // Resultado (Azul ou Amarelo)
          ],
          borderColor: [
            'rgba(40, 167, 69, 1)',
            'rgba(220, 53, 69, 1)',
            netResult >= 0 ? 'rgba(0, 123, 255, 1)' : 'rgba(255, 193, 7, 1)'
          ],
          borderWidth: 1
        }];
        break;

      case 'crop_production':
        chartTitle = 'Produção Total por Cultura (kg)';
        chartType = 'bar';
        const cropProductionData: { [key: string]: number } = {};

        filteredProducoes.forEach(prod => { // 'filteredProducoes' em vez de 'filteredCrops'
          if (!cropProductionData[prod.cultura]) { // 'cultura' em vez de 'name'
            cropProductionData[prod.cultura] = 0;
          }
          cropProductionData[prod.cultura] += (prod.quantidade || 0); // 'quantidade' em vez de 'actualYield'
        });

        labels = Object.keys(cropProductionData).sort();
        data = labels.map(label => cropProductionData[label]);

        datasets = [{
          label: 'Produção (kg)',
          data: data,
          backgroundColor: 'rgba(153, 102, 255, 0.6)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1
        }];
        break;
    }

    // Cria o novo gráfico
    this.reportChart = new Chart(ctx, {
      type: chartType,
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: chartTitle,
            font: { size: 16 }
          },
          legend: {
            display: datasets.length > 1 || (datasets.length === 1 && datasets[0].label !== chartTitle) // Exibe legenda se houver múltiplos datasets ou o label for diferente do título
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: this.getAxisYTitle(this.reportType)
            },
            ticks: {
              callback: (value: any) => { // Usando função de seta para manter o 'this' contextual
                if (this.reportType === 'financial') {
                  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
                }
                return new Intl.NumberFormat('pt-BR').format(value);
              }
            }
          },
          x: {
            title: {
              display: true,
              text: this.getAxisXTitle(this.reportType)
            }
          }
        }
      }
    });
  }

  /**
   * Retorna o título do eixo Y com base no tipo de relatório.
   */
  getAxisYTitle(reportType: string): string {
    switch (reportType) {
      case 'productivity': return 'Produtividade (kg/ha)';
      case 'financial': return 'Valor (R$)';
      case 'crop_production': return 'Produção (kg)';
      default: return 'Valor';
    }
  }

  /**
   * Retorna o título do eixo X com base no tipo de relatório.
   */
  getAxisXTitle(reportType: string): string {
    switch (reportType) {
      case 'productivity': return 'Culturas';
      case 'financial': return 'Categorias';
      case 'crop_production': return 'Culturas';
      default: return '';
    }
  }

  // --- Métodos de UI ---

  alternarMenu() {
    this.menuAberto = !this.menuAberto;
  }

  @HostListener('document:click', ['$event'])
  fecharMenuFora(event: MouseEvent) {
    const alvo = event.target as HTMLElement;
    const clicouNoBotao = alvo.closest('.menu-toggle');
    const clicouNoMenu = alvo.closest('.main-menu');

    if (!clicouNoBotao && !clicouNoMenu) {
      this.menuAberto = false;
    }
  }
}