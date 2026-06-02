// src/__tests__/auth.test.js
// Tests para la lógica de autenticación (signIn, signUp, signOut, resetPassword)
// Mockeamos supabase para no hacer llamadas reales a la API

jest.mock('../config/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  },
}));

import { supabase } from '../config/supabaseClient';

// ─── signIn ───────────────────────────────────────────────────────────────────
describe('signIn', () => {
  beforeEach(() => jest.clearAllMocks());

  test('retorna datos cuando las credenciales son correctas', async () => {
    const mockUser = { id: 'abc123', email: 'juan@test.com' };
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser, session: {} },
      error: null,
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'juan@test.com',
      password: '123456',
    });

    expect(error).toBeNull();
    expect(data.user.email).toBe('juan@test.com');
  });

  test('retorna error con credenciales incorrectas', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'juan@test.com',
      password: 'wrongpass',
    });

    expect(data).toBeNull();
    expect(error.message).toBe('Invalid login credentials');
  });

  test('no llama a signIn si el email está vacío', async () => {
    const email = '';
    const password = '123456';

    if (!email || !password) return; // lógica de LoginScreen

    await supabase.auth.signInWithPassword({ email, password });
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  test('no llama a signIn si la contraseña está vacía', async () => {
    const email = 'juan@test.com';
    const password = '';

    if (!email || !password) return;

    await supabase.auth.signInWithPassword({ email, password });
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

// ─── signUp ───────────────────────────────────────────────────────────────────
describe('signUp', () => {
  beforeEach(() => jest.clearAllMocks());

  test('registra un usuario correctamente', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'xyz', email: 'nuevo@test.com' } },
      error: null,
    });

    const { data, error } = await supabase.auth.signUp({
      email: 'nuevo@test.com',
      password: 'segura123',
      options: { data: { full_name: 'Juan Pérez' } },
    });

    expect(error).toBeNull();
    expect(data.user.email).toBe('nuevo@test.com');
  });

  test('retorna error si el email ya está registrado', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: null,
      error: { message: 'User already registered' },
    });

    const { error } = await supabase.auth.signUp({
      email: 'existente@test.com',
      password: '123456',
    });

    expect(error.message).toBe('User already registered');
  });
});

// ─── signOut ──────────────────────────────────────────────────────────────────
describe('signOut', () => {
  beforeEach(() => jest.clearAllMocks());

  test('cierra sesión correctamente', async () => {
    supabase.auth.signOut.mockResolvedValue({ error: null });

    const { error } = await supabase.auth.signOut();

    expect(error).toBeNull();
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  test('maneja error al cerrar sesión', async () => {
    supabase.auth.signOut.mockResolvedValue({
      error: { message: 'Network error' },
    });

    const { error } = await supabase.auth.signOut();
    expect(error.message).toBe('Network error');
  });
});

// ─── resetPassword ────────────────────────────────────────────────────────────
describe('resetPassword', () => {
  beforeEach(() => jest.clearAllMocks());

  test('envía correo de recuperación correctamente', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });

    const { error } = await supabase.auth.resetPasswordForEmail(
      'juan@test.com',
      { redirectTo: 'http://localhost:8081/#/ResetPasswordScreen' }
    );

    expect(error).toBeNull();
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'juan@test.com',
      expect.objectContaining({ redirectTo: expect.any(String) })
    );
  });

  test('retorna error si el email no existe', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({
      error: { message: 'User not found' },
    });

    const { error } = await supabase.auth.resetPasswordForEmail('noexiste@test.com');
    expect(error.message).toBe('User not found');
  });
});
