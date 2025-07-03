import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

// ====================================================================
// Interfaces com nomes e campos em português (DA SUA API)
// ====================================================================

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  fotoPerfil?: string;
  senha: string;
}

export interface Propriedade {
  id: string;
  nome: string;
  localizacao: string;
  area: number;
  proprietario: string;
}

export interface Producao {
  id: number;
  propriedadeId: number;
  cultura: string;
  safra: string;
  quantidade: number;
  area: number;
  data: Date;
}

export interface Atividade {
  id: string;
  descricao: string;
  data: string; 
  tipo: string;
  propriedade?: string;
  responsavel: string;
  icone?: string;
}

export interface Movimentacao {
  id: number;
  tipo: 'receita' | 'despesa';
  descricao: string;
  valor: number;
  data: Date; // Na API, 'data' é Date para Movimentacao
  propriedade?: string;
  categoria?: string;
}

// ====================================================================
// Serviço Angular
// ====================================================================

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private baseUrl = 'http://localhost:5050/api';
  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  isLoggedIn(): boolean {
    return this.isBrowser ? !!this.getToken() : false;
  }

  register(dadosUsuario: any): Observable<any> {
    return this.http.post(`${this.baseUrl.replace('/api', '')}/auth/register`, dadosUsuario);
  }

  login(email: string, senha: string): Observable<any> {
    return this.http.post(`${this.baseUrl.replace('/api', '')}/auth/login`, { email, senha }).pipe(
      map((response: any) => {
        if (response.token && response.user) {
          this.setToken(response.token);
          this.setUser(response.user);
        }
        return response;
      })
    );
  }

  setToken(token: string): void {
    if (this.isBrowser) localStorage.setItem('token', token);
  }

  getToken(): string | null {
    return this.isBrowser ? localStorage.getItem('token') : null;
  }

  setUser(usuario: Usuario): void {
    if (this.isBrowser) localStorage.setItem('user', JSON.stringify(usuario));
  }

  getUser(): Usuario | null {
    if (this.isBrowser) {
      const json = localStorage.getItem('user');
      return json ? JSON.parse(json) : null;
    }
    return null;
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
  }

  // ====================================================================
  // Métodos para Dashboard e Perfil
  // ====================================================================

  getPerfilUsuario(): Observable<Usuario | null> {
    return this.http.get<Usuario>(`${this.baseUrl}/users/me`).pipe(
      catchError(error => {
        console.error('Erro ao buscar perfil do usuário:', error);
        return of(null);
      })
    );
  }

  atualizarPerfilUsuario(idUsuario: string, dados: Partial<Usuario>): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.baseUrl}/users/${idUsuario}`, dados).pipe(
      catchError(error => {
        console.error('Erro ao atualizar perfil:', error);
        throw error;
      })
    );
  }

  carregarDadosDashboard(): Observable<{
    perfil: Usuario | null;
    propriedades: Propriedade[];
    producoes: Producao[];
    atividades: Atividade[];
    movimentacoes: Movimentacao[];
  }> {
    return forkJoin({
      perfil: this.getPerfilUsuario(),
      propriedades: this.getPropriedades(),
      producoes: this.getProducoes(),
      atividades: this.getAtividades(),
      movimentacoes: this.getMovimentacoes()
    }).pipe(
      catchError(error => {
        console.error('Erro ao carregar dados:', error);
        return of({
          perfil: null,
          propriedades: [],
          producoes: [],
          atividades: [],
          movimentacoes: []
        });
      })
    );
  }

  // ====================================================================
  // CRUD: Propriedades
  // ====================================================================

  getPropriedades(): Observable<Propriedade[]> {
    return this.http.get<Propriedade[]>(`${this.baseUrl}/properties`).pipe(
      catchError(error => {
        console.error('Erro ao buscar propriedades:', error);
        return of([]);
      })
    );
  }

  adicionarPropriedade(prop: Omit<Propriedade, 'id' | 'proprietario'>): Observable<Propriedade> {
    return this.http.post<Propriedade>(`${this.baseUrl}/properties`, prop);
  }

  atualizarPropriedade(id: string, prop: Partial<Propriedade>): Observable<Propriedade> {
    return this.http.put<Propriedade>(`${this.baseUrl}/properties/${id}`, prop);
  }

  excluirPropriedade(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/properties/${id}`);
  }

  // ====================================================================
  // CRUD: Produções
  // ====================================================================

  getProducoes(): Observable<Producao[]> {
    return this.http.get<Producao[]>(`${this.baseUrl}/crops`).pipe(
      catchError(error => {
        console.error('Erro ao buscar produções:', error);
        return of([]);
      })
    );
  }

  adicionarProducao(prod: Omit<Producao, 'id'>): Observable<Producao> {
    return this.http.post<Producao>(`${this.baseUrl}/crops`, prod);
  }

  atualizarProducao(id: string, prod: Partial<Producao>): Observable<Producao> {
    return this.http.put<Producao>(`${this.baseUrl}/crops/${id}`, prod);
  }

  excluirProducao(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/crops/${id}`);
  }

  // ====================================================================
  // CRUD: Atividades
  // ====================================================================

  getAtividades(): Observable<Atividade[]> {
    return this.http.get<Atividade[]>(`${this.baseUrl}/activities`).pipe(
      catchError(error => {
        console.error('Erro ao buscar atividades:', error);
        return of([]);
      })
    );
  }

  adicionarAtividade(atv: Omit<Atividade, 'id' | 'responsavel' | 'icone'>): Observable<Atividade> {
    return this.http.post<Atividade>(`${this.baseUrl}/activities`, atv);
  }

  atualizarAtividade(id: string, atv: Partial<Omit<Atividade, 'icone'>>): Observable<Atividade> {
    return this.http.put<Atividade>(`${this.baseUrl}/activities/${id}`, atv);
  }

  excluirAtividade(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/activities/${id}`);
  }

  // ====================================================================
  // CRUD: Movimentações
  // ====================================================================

  getMovimentacoes(): Observable<Movimentacao[]> {
    return this.http.get<Movimentacao[]>(`${this.baseUrl}/financial`).pipe(
      catchError(error => {
        console.error('Erro ao buscar movimentações:', error);
        return of([]);
      })
    );
  }

  adicionarMovimentacao(mov: Omit<Movimentacao, 'id'>): Observable<Movimentacao> {
    return this.http.post<Movimentacao>(`${this.baseUrl}/financial`, mov);
  }

  atualizarMovimentacao(id: string, mov: Partial<Movimentacao>): Observable<Movimentacao> {
    return this.http.put<Movimentacao>(`${this.baseUrl}/financial/${id}`, mov);
  }

  excluirMovimentacao(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/financial/${id}`);
  }
}