import { Component, HostListener, OnInit, Renderer2, Inject } from '@angular/core';
import { DOCUMENT, CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
// Importa a interface Usuario diretamente da ApiService para garantir consistência
import { ApiService, Usuario } from '../../../services/api.service';

@Component({
  selector: 'app-usuario',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],
  providers: [DatePipe],
  templateUrl: './usuario.component.html',
  styleUrls: ['./usuario.component.css']
})
export class UsuarioComponent implements OnInit {

  menuAberto = false;
  usuarioNome: string = '';
  usuarioFoto: string = 'https://placehold.co/40x40/aabbcc/ffffff?text=User';

  
  
  usuario: Usuario = {
    id: '', 
    nome: '', 
    email: '',
    telefone: '',
    fotoPerfil: 'https://placehold.co/40x40/aabbcc/ffffff?text=User',
    senha: '' // Senha não deve ser armazenada ou manipulada no front-end
  };

 
  usuarioEditavel: Partial<Usuario> = {};

  editModalAberto = false;

  constructor(
    private datePipe: DatePipe,
    private router: Router,
    private apiService: ApiService,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) { }

  ngOnInit(): void {
    this.carregarPerfilUsuario(); 
  }

  carregarPerfilUsuario(): void {
    const userLocal = this.apiService.getUser();

    if (userLocal && userLocal.id) {
      // Pré-carrega os dados locais para uma exibição mais rápida
      this.usuario = { ...userLocal, senha: '' };
      this.atualizarHeaderInfo();

      // Tenta buscar o perfil mais recente do backend
      this.apiService.getPerfilUsuario().subscribe({
        next: (userFromApi) => {
          if (userFromApi) {
            // Se a API retornou o usuário, atualize os dados locais
            this.usuario = {
              ...userFromApi,
              fotoPerfil: userFromApi.fotoPerfil || 'https://placehold.co/40x40/aabbcc/ffffff?text=User', 
              senha: ''
            };
            // Atualiza também o localStorage com os dados mais recentes
            this.apiService.setUser(this.usuario);
          } else {
            // Se a API falhou mas temos dados locais, apenas logamos o aviso
            console.warn('Perfil não encontrado na API. Usando dados do localStorage.');
            // Não fazemos logout aqui. O usuário continua com os dados que já tinha.
          }
          this.atualizarHeaderInfo(); 
          this.usuarioEditavel = { ...this.usuario }; 
        },
        error: (err) => {
          console.error('Erro ao carregar perfil do usuário da API. Usando dados locais.', err);
          // Em caso de erro de rede ou outro, também não deslogamos
          this.atualizarHeaderInfo();
          this.usuarioEditavel = { ...this.usuario };
        }
      });
    } else {
      // Se não há usuário no localStorage, não há sessão ativa, redireciona.
      console.warn('Usuário não logado ou sem ID no localStorage. Redirecionando para home.');
      this.router.navigate(['/home']);
    }
  }

  alternarMenu(): void {
    this.menuAberto = !this.menuAberto;
  }

  @HostListener('document:click', ['$event'])
  fecharMenuFora(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.menuAberto && !target.closest('.menu-toggle') && !target.closest('.main-menu')) {
      this.menuAberto = false;
    }
  }

  abrirModalEdicao(): void {
    this.usuarioEditavel = { ...this.usuario };
    this.editModalAberto = true;
  }

  fecharModalEdicao(): void {
    this.editModalAberto = false;
  }

  salvarAlteracoesPerfil(): void {
    if (!this.usuarioEditavel.id) {
      console.error('ID do usuário não disponível para atualização.');
      return;
    }

    const payload: Partial<Usuario> = {
      nome: this.usuarioEditavel.nome,
      email: this.usuarioEditavel.email,
      telefone: this.usuarioEditavel.telefone,
      fotoPerfil: this.usuarioEditavel.fotoPerfil,
    };

    this.apiService.atualizarPerfilUsuario(this.usuarioEditavel.id, payload).subscribe({
      next: (updatedUser) => {
        console.log('Perfil atualizado com sucesso:', updatedUser);
        this.usuario = {
            ...this.usuario, // Mantém dados existentes
            ...updatedUser, // Sobrescreve com os atualizados
            fotoPerfil: updatedUser.fotoPerfil || 'https://placehold.co/40x40/aabbcc/ffffff?text=User',
        };
        // Atualiza o usuário no localStorage para manter a sessão consistente
        this.apiService.setUser(this.usuario);

        this.atualizarHeaderInfo(); 
        this.fecharModalEdicao();
        alert('Perfil atualizado com sucesso!');
      },
      error: (err) => {
        console.error('Erro ao salvar alterações no perfil:', err);
        alert('Erro ao atualizar perfil. Tente novamente.');
      }
    });
  }

  private atualizarHeaderInfo(): void {
    if (this.usuario) {
      this.usuarioNome = this.usuario.nome;
      this.usuarioFoto = this.usuario.fotoPerfil || 'https://placehold.co/40x40/aabbcc/ffffff?text=User';
    }
  }

  navegarParaContato(): void {
    this.router.navigate(['/contato']);
  }
}