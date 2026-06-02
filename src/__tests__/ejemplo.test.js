describe('Pruebas de ejemplo', () => {
  test('suma básica', () => {
    expect(2 + 2).toBe(4);
  });

  test('string contiene texto', () => {
    expect('TeamW App').toContain('TeamW');
  });

  test('array tiene elementos', () => {
    const usuarios = ['Ana', 'Luis', 'Pedro'];
    expect(usuarios).toHaveLength(3);
    expect(usuarios).toContain('Ana');
  });
});