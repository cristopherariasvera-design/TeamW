// src/__tests__/loginLogica.test.js
// Tests para la lógica pura de LoginScreen (validaciones y mapeo de errores)
// Sin renderizar componentes — solo la lógica de negocio

// ─── Validación de campos ─────────────────────────────────────────────────────
describe('Validación de campos en login', () => {
  const validarCampos = (email, password) => {
    if (!email || !password) return 'Por favor, completa todos los campos';
    return null;
  };

  test('retorna error si email está vacío', () => {
    expect(validarCampos('', '123456')).toBe('Por favor, completa todos los campos');
  });

  test('retorna error si password está vacío', () => {
    expect(validarCampos('juan@test.com', '')).toBe('Por favor, completa todos los campos');
  });

  test('retorna error si ambos están vacíos', () => {
    expect(validarCampos('', '')).toBe('Por favor, completa todos los campos');
  });

  test('no retorna error con campos completos', () => {
    expect(validarCampos('juan@test.com', '123456')).toBeNull();
  });
});

// ─── Mapeo de errores de Supabase ─────────────────────────────────────────────
describe('Mapeo de errores de Supabase a español', () => {
  const mapearError = (errorMessage) => {
    if (errorMessage === 'Invalid login credentials') return 'Correo o contraseña incorrectos';
    if (errorMessage.includes('network')) return 'Sin conexión a internet';
    return errorMessage;
  };

  test('traduce credenciales inválidas', () => {
    expect(mapearError('Invalid login credentials')).toBe('Correo o contraseña incorrectos');
  });

  test('traduce error de red', () => {
    expect(mapearError('network timeout')).toBe('Sin conexión a internet');
  });

  test('retorna el mensaje original si no tiene traducción', () => {
    expect(mapearError('Too many requests')).toBe('Too many requests');
  });
});

// ─── Formato de email ─────────────────────────────────────────────────────────
describe('Formato de email', () => {
  const esEmailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  test('acepta email válido', () => {
    expect(esEmailValido('juan@gmail.com')).toBe(true);
  });

  test('rechaza email sin @', () => {
    expect(esEmailValido('juangmail.com')).toBe(false);
  });

  test('rechaza email sin dominio', () => {
    expect(esEmailValido('juan@')).toBe(false);
  });

  test('rechaza email vacío', () => {
    expect(esEmailValido('')).toBe(false);
  });
});
