// src/__tests__/AuthContext.test.js

const mockSingle = jest.fn();

jest.mock('../config/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: mockSingle,
    })),
  },
}));

import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabaseClient';

// Componente auxiliar para leer el contexto
const TestConsumer = () => {
  const {
    user,
    profile,
    loading,
    isRecovering,
    signIn,
    signUp,
    signOut,
    resetPassword,
  } = useAuth();

  React.useEffect(() => {
    global.testActions = {
      signIn,
      signUp,
      signOut,
      resetPassword,
    };
  }, [signIn, signUp, signOut, resetPassword]);

  return (
    <>
      <Text testID="user">
        {user ? user.email : 'sin-usuario'}
      </Text>

      <Text testID="profile">
        {profile ? profile.full_name : 'sin-perfil'}
      </Text>

      <Text testID="loading">
        {loading ? 'cargando' : 'listo'}
      </Text>

      <Text testID="recovering">
        {isRecovering ? 'recuperando' : 'normal'}
      </Text>
    </>
  );
};

const renderWithAuth = () =>
  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

// ─────────────────────────────────────────────────────────────
// Estado inicial
// ─────────────────────────────────────────────────────────────

describe('AuthContext — estado inicial', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
    });

    supabase.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    });

    mockSingle.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  test('inicia sin usuario', async () => {
    const { getByTestId } = renderWithAuth();

    await waitFor(() =>
      expect(
        getByTestId('loading').props.children
      ).toBe('listo')
    );

    expect(
      getByTestId('user').props.children
    ).toBe('sin-usuario');
  });

  test('isRecovering inicia en false', async () => {
    const { getByTestId } = renderWithAuth();

    await waitFor(() =>
      expect(
        getByTestId('loading').props.children
      ).toBe('listo')
    );

    expect(
      getByTestId('recovering').props.children
    ).toBe('normal');
  });
});

// ─────────────────────────────────────────────────────────────
// Sesión activa
// ─────────────────────────────────────────────────────────────

describe('AuthContext — con sesión activa', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'u1',
            email: 'coach@test.com',
          },
        },
      },
    });

    supabase.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    });

    mockSingle.mockResolvedValue({
      data: {
        id: 'u1',
        full_name: 'Coach Test',
        role: 'coach',
      },
      error: null,
    });
  });

  test('carga el usuario desde la sesión', async () => {
    const { getByTestId } = renderWithAuth();

    await waitFor(() =>
      expect(
        getByTestId('user').props.children
      ).toBe('coach@test.com')
    );
  });

  test('carga el perfil desde Supabase', async () => {
    const { getByTestId } = renderWithAuth();

    await waitFor(() =>
      expect(
        getByTestId('profile').props.children
      ).toBe('Coach Test')
    );
  });
});

// ─────────────────────────────────────────────────────────────
// PASSWORD_RECOVERY
// ─────────────────────────────────────────────────────────────

describe('AuthContext — modo recuperación', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
    });

    mockSingle.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  test('activa isRecovering al recibir PASSWORD_RECOVERY', async () => {
    let capturedCallback;

    supabase.auth.onAuthStateChange.mockImplementation((cb) => {
      capturedCallback = cb;

      return {
        data: {
          subscription: {
            unsubscribe: jest.fn(),
          },
        },
      };
    });

    const { getByTestId } = renderWithAuth();

    await act(async () => {
      capturedCallback('PASSWORD_RECOVERY', {
        user: {
          id: 'u1',
          email: 'recovery@test.com',
        },
      });
    });

    await waitFor(() =>
      expect(
        getByTestId('recovering').props.children
      ).toBe('recuperando')
    );
  });
});

// ─────────────────────────────────────────────────────────────
// useAuth
// ─────────────────────────────────────────────────────────────

describe('useAuth', () => {
  test('lanza error si se usa fuera del AuthProvider', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const BadComponent = () => {
      useAuth();
      return null;
    };

    expect(() =>
      render(<BadComponent />)
    ).toThrow(
      'useAuth must be used within an AuthProvider'
    );

    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────
// Funciones públicas
// ─────────────────────────────────────────────────────────────

describe('AuthContext — acciones', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
    });

    supabase.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    });

    mockSingle.mockResolvedValue({
      data: {
        id: 'u1',
        full_name: 'Coach Test',
        role: 'coach',
      },
      error: null,
    });
  });

  test('signIn llama a signInWithPassword', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: null,
    });

    renderWithAuth();

    await act(async () => {
      await global.testActions.signIn(
        'test@test.com',
        '123456'
      );
    });

    expect(
      supabase.auth.signInWithPassword
    ).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: '123456',
    });
  });

  test('signUp llama a signUp', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: {},
      error: null,
    });

    renderWithAuth();

    await act(async () => {
      await global.testActions.signUp(
        'test@test.com',
        '123456',
        'Cristopher'
      );
    });

    expect(
      supabase.auth.signUp
    ).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: '123456',
      options: {
        data: {
          full_name: 'Cristopher',
        },
      },
    });
  });

  test('signOut llama a signOut', async () => {
    supabase.auth.signOut.mockResolvedValue({
      error: null,
    });

    renderWithAuth();

    await act(async () => {
      await global.testActions.signOut();
    });

    expect(
      supabase.auth.signOut
    ).toHaveBeenCalledTimes(1);
  });

  test('resetPassword llama a resetPasswordForEmail', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: null,
    });

    renderWithAuth();

    await act(async () => {
      await global.testActions.resetPassword(
        'test@test.com'
      );
    });

    expect(
      supabase.auth.resetPasswordForEmail
    ).toHaveBeenCalledTimes(1);
  });
});